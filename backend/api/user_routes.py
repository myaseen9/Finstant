from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import boto3
import traceback
import re
import uuid
from sqlalchemy import text
from query_engine.executor import get_app_engine
from api.dependencies import get_current_user, require_admin

router = APIRouter()

COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "us-east-1_uE4RzWIhm")

def get_cognito():
    # 100% IAM Instance Role credentials
    return boto3.client("cognito-idp", region_name=COGNITO_REGION)


@router.get("/users")
@router.get("/api/users")
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
            "id": r[0], "username": r[1],
            "name": f"{r[2]} {r[3]}".strip() if (r[2] or r[3]) else r[1],
            "first_name": r[2], "last_name": r[3],
            "role": r[4], "designation": r[5], "is_active": r[6],
            "created_at": r[7].isoformat() if r[7] else None
        }
        for r in rows
    ]


class CreateUserRequest(BaseModel):
    username: str = ""   # email or desired username
    name: str = ""       # Unified Name field (e.g. "Dr Sara Khan")
    first_name: str = "" # Backwards compatibility
    last_name: str = ""
    role: str = "user"  # "user" or "admin"
    designation: str = "Accountant"


@router.post("/users")
@router.post("/api/users")
async def create_user(req: CreateUserRequest, current_user: dict = Depends(require_admin)):
    full_name = req.name.strip() if req.name else f"{req.first_name.strip()} {req.last_name.strip()}".strip()
    if not full_name and not req.username.strip():
        raise HTTPException(status_code=400, detail="Name and email are required.")

    cognito = get_cognito()
    engine = get_app_engine()

    # 1. Generate a valid, clean non-email Cognito username
    if full_name:
        clean_base = re.sub(r'[^a-zA-Z0-9._-]', '_', full_name.lower())
        clean_base = re.sub(r'_+', '_', clean_base).strip('_')
        cognito_username = clean_base
    else:
        email_prefix = req.username.split("@")[0].lower()
        cognito_username = re.sub(r'[^a-zA-Z0-9._-]', '', email_prefix)

    if not cognito_username:
        cognito_username = f"user_{uuid.uuid4().hex[:8]}"

    # Determine email value
    raw_input_email = req.username.strip().lower()
    email_val = raw_input_email if "@" in raw_input_email else f"{cognito_username}@finstant.local"

    cognito_sub = None
    is_existing_cognito_user = False

    # 2. Attempt creation in AWS Cognito
    try:
        try:
            response = cognito.admin_create_user(
                UserPoolId=USER_POOL_ID,
                Username=cognito_username,
                UserAttributes=[
                    {"Name": "email", "Value": email_val},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "given_name", "Value": full_name},
                    {"Name": "family_name", "Value": ""},
                ],
                DesiredDeliveryMediums=["EMAIL"]
            )
            cognito_sub = next(
                a["Value"] for a in response["User"]["Attributes"] if a["Name"] == "sub"
            )
        except Exception as email_err:
            if "UsernameExistsException" in str(email_err):
                raise email_err
            print(f"Cognito EMAIL delivery notice: {email_err}. Creating with temporary password...")
            response = cognito.admin_create_user(
                UserPoolId=USER_POOL_ID,
                Username=cognito_username,
                UserAttributes=[
                    {"Name": "email", "Value": email_val},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "given_name", "Value": full_name},
                    {"Name": "family_name", "Value": ""},
                ],
                TemporaryPassword="TempPassword2026!",
                MessageAction="SUPPRESS"
            )
            cognito_sub = next(
                a["Value"] for a in response["User"]["Attributes"] if a["Name"] == "sub"
            )

    except cognito.exceptions.UsernameExistsException:
        # User already exists in Cognito — gracefully fetch existing Cognito profile
        print(f"Cognito user '{cognito_username}' already exists. Synchronizing with local database...")
        is_existing_cognito_user = True
        try:
            existing_user = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=cognito_username)
            cognito_sub = next(
                (a["Value"] for a in existing_user["UserAttributes"] if a["Name"] == "sub"),
                str(uuid.uuid4())
            )
        except Exception as get_err:
            print(f"Error fetching existing Cognito user: {get_err}")
            cognito_sub = str(uuid.uuid4())

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AWS Cognito Error: {str(e)}")

    # 3. Synchronize Group Membership in Cognito
    if req.role in ("admin", "superadmin"):
        try:
            cognito.admin_add_user_to_group(
                UserPoolId=USER_POOL_ID,
                Username=cognito_username,
                GroupName="Admin" if req.role == "admin" else "SuperAdmin"
            )
        except Exception as e:
            print(f"Cognito group add notice: {e}")

    # 4. Insert or Update in local PostgreSQL
    try:
        with engine.connect() as conn:
            # Check if user already exists locally
            existing_db = conn.execute(
                text("SELECT id, username, first_name, last_name, role, designation, is_active FROM app_user WHERE username = :uname OR cognito_sub_id = :sub"),
                {"uname": cognito_username, "sub": cognito_sub}
            ).fetchone()

            if existing_db:
                conn.execute(
                    text("""
                        UPDATE app_user 
                        SET role = :role, designation = :desig, first_name = :fname, last_name = '', cognito_sub_id = :sub
                        WHERE id = :id
                    """),
                    {
                        "role": req.role, "desig": req.designation,
                        "fname": full_name,
                        "sub": cognito_sub, "id": existing_db[0]
                    }
                )
                conn.commit()
                return {
                    "message": f"User '{cognito_username}' already existed in Cognito and is now synchronized!",
                    "user": {
                        "id": existing_db[0], "username": cognito_username,
                        "name": full_name, "first_name": full_name, "last_name": "",
                        "role": req.role, "designation": req.designation, "is_active": existing_db[6]
                    }
                }

            # New DB row insertion
            result = conn.execute(text("""
                INSERT INTO app_user (username, cognito_sub_id, first_name, last_name, role, designation, is_active, created_at)
                VALUES (:uname, :sub, :fname, '', :role, :desig, true, now())
                RETURNING id, username, first_name, last_name, role, designation, is_active
            """), {
                "uname": cognito_username, "sub": cognito_sub,
                "fname": full_name,
                "role": req.role, "desig": req.designation
            })
            row = result.fetchone()
            conn.commit()

    except Exception as e:
        traceback.print_exc()
        if not is_existing_cognito_user:
            try:
                cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=cognito_username)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "message": f"User '{cognito_username}' created successfully! Temporary password: TempPassword2026!",
        "user": {
            "id": row[0], "username": row[1], "name": row[2],
            "first_name": row[2], "last_name": "", "role": row[4], "designation": row[5], "is_active": row[6]
        }
    }


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


class UpdateUserRequest(BaseModel):
    id: int
    is_active: bool = None
    role: str = None

@router.put("/users")
@router.put("/api/users")
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
    if req.is_active is not None:
        background_tasks.add_task(sync_cognito_status, username, req.is_active)
        updates["is_active"] = req.is_active

    if req.role is not None and req.role != current_role:
        background_tasks.add_task(sync_cognito_role, username, current_role, req.role)
        updates["role"] = req.role

    if not updates:
        raise HTTPException(status_code=400, detail="No valid update fields provided.")

    set_clauses = ", ".join([f"{k} = :{k}" for k in updates])
    updates["id"] = req.id
    with engine.connect() as conn:
        conn.execute(text(f"UPDATE app_user SET {set_clauses} WHERE id = :id"), updates)
        conn.commit()

    return {"message": "User updated successfully."}


class DeleteUserRequest(BaseModel):
    id: int

@router.delete("/users")
@router.delete("/api/users")
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

    try:
        cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
    except Exception as e:
        print(f"Cognito delete warning: {e}")

    with engine.connect() as conn:
        conn.execute(text("DELETE FROM app_user WHERE id = :id"), {"id": req.id})
        conn.commit()

    return {"message": "User permanently deleted from both AWS and local database."}


class UpdateProfileRequest(BaseModel):
    name: str = ""
    first_name: str = ""
    last_name: str = ""

@router.put("/profile")
@router.put("/api/profile")
async def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    full_name = req.name.strip() if req.name else f"{req.first_name.strip()} {req.last_name.strip()}".strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    # Generate clean sanitized username from the new name
    clean_base = re.sub(r'[^a-zA-Z0-9._-]', '_', full_name.lower())
    clean_base = re.sub(r'_+', '_', clean_base).strip('_')
    new_username = clean_base if clean_base else current_user["username"]

    engine = get_app_engine()
    final_username = current_user["username"]

    with engine.connect() as conn:
        # Check if another user already has this username
        existing = conn.execute(
            text("SELECT id FROM app_user WHERE username = :uname AND id != :id"),
            {"uname": new_username, "id": current_user["id"]}
        ).fetchone()

        if not existing and new_username:
            final_username = new_username

        conn.execute(text("""
            UPDATE app_user 
            SET first_name = :fname, last_name = '', username = :uname 
            WHERE id = :id
        """), {"fname": full_name, "uname": final_username, "id": current_user["id"]})
        conn.commit()

    try:
        cognito = get_cognito()
        cognito.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=current_user["username"],
            UserAttributes=[
                {"Name": "given_name", "Value": full_name},
                {"Name": "family_name", "Value": ""},
            ]
        )
    except Exception as e:
        print(f"Cognito attribute update warning: {e}")

    return {
        "message": "Profile updated successfully.",
        "name": full_name,
        "first_name": full_name,
        "username": final_username
    }

