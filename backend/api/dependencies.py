import os
import requests
from fastapi import Request, HTTPException, Depends
from sqlalchemy import text
from query_engine.executor import get_app_engine
from jose import jwt

COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")
JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"

_jwks_cache = None

def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        try:
            _jwks_cache = requests.get(JWKS_URL).json()
        except Exception as e:
            print(f"Error fetching JWKS from {JWKS_URL}: {e}")
            raise HTTPException(status_code=500, detail="Could not retrieve JWKS")
    return _jwks_cache

def get_current_user(request: Request) -> dict:
    """
    Reads the Authorization header, validates the AWS Cognito JWT,
    and returns the authenticated user's info from the local database.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
    elif request.cookies.get("finstant_token"):
        token = request.cookies.get("finstant_token")
    elif request.query_params.get("token"):
        token = request.query_params.get("token")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        claims = jwt.decode(
            token, 
            get_jwks(), 
            algorithms=["RS256"],
            audience=APP_CLIENT_ID, 
            issuer=f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}",
            options={"verify_at_hash": False, "leeway": 120}
        )
    except jwt.JWTError as e:
        print(f"JWT Validation Error: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")

    cognito_sub_id = claims.get("sub")
    email_val = (claims.get("email") or "").strip()
    cognito_uname = (claims.get("cognito:username") or "").strip()
    uname_val = email_val or cognito_uname or (claims.get("username") or "").strip()
    groups = claims.get("cognito:groups", [])
    computed_role = "superadmin" if "SuperAdmin" in groups else ("admin" if "Admin" in groups else "user")

    engine = get_app_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, username, role, first_name, last_name, designation, cognito_sub_id
                FROM app_user
                WHERE (cognito_sub_id IS NOT NULL AND cognito_sub_id = :sub)
                   OR (username IS NOT NULL AND LOWER(username) = LOWER(:email))
                   OR (username IS NOT NULL AND LOWER(username) = LOWER(:cognito_uname))
                   OR (username IS NOT NULL AND LOWER(username) = LOWER(:uname))
                ORDER BY id ASC
                LIMIT 1
            """),
            {
                "sub": cognito_sub_id,
                "email": email_val,
                "cognito_uname": cognito_uname,
                "uname": uname_val
            }
        ).fetchone()

        if not row:
            # The user exists in Cognito but hasn't been synced to the local DB yet.
            fname = claims.get("given_name") or claims.get("name") or claims.get("cognito:username") or "User"
            lname = claims.get("family_name", "")
            desig = groups[0] if groups else "User"
            res = conn.execute(
                text("""
                    INSERT INTO app_user (username, cognito_sub_id, first_name, last_name, role, designation, is_active, created_at)
                    VALUES (:uname, :sub, :fname, :lname, :role, :desig, true, now())
                    RETURNING id, username, role, first_name, last_name, designation, cognito_sub_id
                """),
                {
                    "uname": uname_val, "sub": cognito_sub_id, "fname": fname,
                    "lname": lname, "role": computed_role, "desig": desig
                }
            )
            conn.commit()
            row = res.fetchone()
        else:
            # If matched by username/email but cognito_sub_id was not set or changed, sync it now
            user_id, username, db_role, first_name, last_name, designation, stored_sub = row
            if not stored_sub or stored_sub != cognito_sub_id:
                conn.execute(
                    text("UPDATE app_user SET cognito_sub_id = :sub WHERE id = :id"),
                    {"sub": cognito_sub_id, "id": user_id}
                )
                conn.commit()

        user_id, username, db_role, first_name, last_name, designation = row[:6]

    full_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else username

    return {
        "id": user_id,
        "cognito_sub_id": cognito_sub_id,
        "username": username,
        "name": full_name,
        "first_name": full_name,
        "last_name": last_name,
        "role": computed_role if computed_role != "user" else db_role,
        "designation": designation,
        "designations": groups
    }



def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that ensures the current user has admin privileges.
    Raises 403 if the user is not an admin.
    """
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
