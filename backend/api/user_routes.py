from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import boto3
import traceback
from sqlalchemy import text
from query_engine.executor import get_app_engine
from api.dependencies import get_current_user, require_admin

router = APIRouter()

COGNITO_REGION = os.getenv("COGNITO_REGION", "eu-north-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")

def get_cognito():
    return boto3.client(
        "cognito-idp",
        region_name=COGNITO_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


# ─────────────────────────────────────────────
# GET /users  — list all users from local DB
# ─────────────────────────────────────────────
@router.get("/users")
async def list_users(current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, username, first_name, last_name, role, designation, is_active, created_at
            FROM app_user
            ORDER BY
                CASE role
                    WHEN 'superadmin' THEN 1
                    WHEN 'admin' THEN 2
                    ELSE 3
                END,
                LOWER(COALESCE(first_name, '')) ASC
        """)).fetchall()
    return [
        {
            "id": r[0], "username": r[1], "first_name": r[2], "last_name": r[3],
            "role": r[4], "designation": r[5], "is_active": r[6],
            "created_at": r[7].isoformat() if r[7] else None
        }
        for r in rows
    ]


# ─────────────────────────────────────────────
# POST /users  — create user in Cognito + DB
# ─────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    username: str       # email address
    first_name: str
    last_name: str = ""
    role: str = "user"  # "user" or "admin"
    designation: str = "Accountant"

@router.post("/users")
async def create_user(req: CreateUserRequest, current_user: dict = Depends(require_admin)):
    if not req.username or not req.first_name:
        raise HTTPException(status_code=400, detail="Email and first name are required.")

    cognito = get_cognito()
    engine = get_app_engine()

    # 1. Create in AWS Cognito — AWS will auto-send welcome email with temp password
    try:
        response = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=req.username.lower(),
            UserAttributes=[
                {"Name": "email", "Value": req.username.lower()},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "given_name", "Value": req.first_name},
                {"Name": "family_name", "Value": req.last_name},
            ],
            DesiredDeliveryMediums=["EMAIL"]  # AWS sends temp password to their email
        )
        cognito_sub = next(
            a["Value"] for a in response["User"]["Attributes"] if a["Name"] == "sub"
        )
    except cognito.exceptions.UsernameExistsException:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AWS Cognito Error: {str(e)}")

    # 2. Add to Cognito group if admin role
    if req.role in ("admin", "superadmin"):
        try:
            cognito.admin_add_user_to_group(
                UserPoolId=USER_POOL_ID,
                Username=req.username.lower(),
                GroupName="Admin"
            )
        except Exception as e:
            print(f"Warning: Could not add to Admin group: {e}")

    # 3. Insert into local PostgreSQL
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                INSERT INTO app_user (username, cognito_sub_id, first_name, last_name, role, designation, is_active, created_at)
                VALUES (:uname, :sub, :fname, :lname, :role, :desig, true, now())
                RETURNING id, username, first_name, last_name, role, designation, is_active
            """), {
                "uname": req.username.lower(), "sub": cognito_sub,
                "fname": req.first_name, "lname": req.last_name,
                "role": req.role, "desig": req.designation
            })
            row = result.fetchone()
            conn.commit()
    except Exception as e:
        # Rollback Cognito user if DB fails
        try:
            cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=req.username.lower())
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "message": "User created! AWS has emailed them a temporary password with login instructions.",
        "user": {
            "id": row[0], "username": row[1], "first_name": row[2],
            "last_name": row[3], "role": row[4], "designation": row[5], "is_active": row[6]
        }
    }


from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks

def sync_cognito_status(username: str, is_active: bool):
    try:
        cognito = get_cognito()
        if is_active:
            cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=username)
        else:
            cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)
    except Exception as e:
        print(f"Background Cognito status sync warning: {e}")

def sync_cognito_role(username: str, old_role: str, new_role: str):
    try:
        cognito = get_cognito()
        if old_role == "admin":
            try:
                cognito.admin_remove_user_from_group(UserPoolId=USER_POOL_ID, Username=username, GroupName="Admin")
            except Exception:
                pass
        if new_role == "admin":
            try:
                cognito.admin_add_user_to_group(UserPoolId=USER_POOL_ID, Username=username, GroupName="Admin")
            except Exception as e:
                print(f"Cognito group add warning: {e}")
    except Exception as e:
        print(f"Background Cognito role sync warning: {e}")

# ─────────────────────────────────────────────
# PUT /users  — update role or is_active
# ─────────────────────────────────────────────
class UpdateUserRequest(BaseModel):
    id: int
    is_active: bool = None
    role: str = None

@router.put("/users")
async def update_user(req: UpdateUserRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    engine = get_app_engine()

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT username, role, cognito_sub_id FROM app_user WHERE id = :id"),
            {"id": req.id}
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    username, current_role, cognito_sub = row

    if current_role == "superadmin":
        raise HTTPException(status_code=403, detail="Cannot modify a SuperAdmin.")

    updates = {}

    # Handle is_active toggle asynchronously in background
    if req.is_active is not None:
        background_tasks.add_task(sync_cognito_status, username, req.is_active)
        updates["is_active"] = req.is_active

    # Handle role change asynchronously in background
    if req.role is not None and req.role != current_role:
        background_tasks.add_task(sync_cognito_role, username, current_role, req.role)
        updates["role"] = req.role

    if not updates:
        raise HTTPException(status_code=400, detail="No valid update fields provided.")

    # Execute DB update immediately in <2ms
    set_clauses = ", ".join([f"{k} = :{k}" for k in updates])
    updates["id"] = req.id
    with engine.connect() as conn:
        conn.execute(text(f"UPDATE app_user SET {set_clauses} WHERE id = :id"), updates)
        conn.commit()

    return {"message": "User updated successfully."}


# ─────────────────────────────────────────────
# DELETE /users  — delete from Cognito + DB
# ─────────────────────────────────────────────
class DeleteUserRequest(BaseModel):
    id: int

@router.delete("/users")
async def delete_user(req: DeleteUserRequest, current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    cognito = get_cognito()

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT username, role FROM app_user WHERE id = :id"),
            {"id": req.id}
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    username, role = row

    if role == "superadmin":
        raise HTTPException(status_code=403, detail="Cannot delete a SuperAdmin.")

    # Delete from Cognito
    try:
        cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
    except Exception as e:
        print(f"Cognito delete warning (user may not exist in Cognito): {e}")

    # Delete from local DB
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM app_user WHERE id = :id"), {"id": req.id})
        conn.commit()

    return {"message": "User permanently deleted from both AWS and local database."}


# ─────────────────────────────────────────────
# PUT /profile  — update own first/last name
# ─────────────────────────────────────────────
class UpdateProfileRequest(BaseModel):
    first_name: str
    last_name: str = ""

@router.put("/profile")
async def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    if not req.first_name.strip():
        raise HTTPException(status_code=400, detail="First name cannot be empty.")

    engine = get_app_engine()
    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE app_user SET first_name = :fname, last_name = :lname WHERE id = :id
        """), {"fname": req.first_name.strip(), "lname": req.last_name.strip(), "id": current_user["id"]})
        conn.commit()

    # Also update Cognito attributes
    try:
        cognito = get_cognito()
        cognito.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=current_user["username"],
            UserAttributes=[
                {"Name": "given_name", "Value": req.first_name.strip()},
                {"Name": "family_name", "Value": req.last_name.strip()},
            ]
        )
    except Exception as e:
        print(f"Cognito attribute update warning: {e}")

    return {"message": "Profile updated successfully.", "first_name": req.first_name, "last_name": req.last_name}
