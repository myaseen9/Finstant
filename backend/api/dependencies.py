import os
import requests
from fastapi import Request, HTTPException, Depends
from sqlalchemy import text
from query_engine.executor import get_app_engine
from jose import jwt

COGNITO_REGION = os.getenv("COGNITO_REGION", "eu-north-1")
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
    if not auth_header.startswith("Bearer "):
        # Fallback to cookies for older clients or server-side requests (if still needed)
        # But generally, SPAs should send Bearer tokens.
        token = request.cookies.get("finstant_token")
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")
    else:
        token = auth_header.replace("Bearer ", "")

    try:
        claims = jwt.decode(
            token, 
            get_jwks(), 
            algorithms=["RS256"],
            audience=APP_CLIENT_ID, 
            issuer=f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}"
        )
    except jwt.JWTError as e:
        print(f"JWT Validation Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    cognito_sub_id = claims["sub"]
    groups = claims.get("cognito:groups", [])
    computed_role = "superadmin" if "SuperAdmin" in groups else ("admin" if "Admin" in groups else "user")

    engine = get_app_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, username, role, first_name, last_name, designation
                FROM app_user
                WHERE cognito_sub_id = :sub
            """),
            {"sub": cognito_sub_id}
        ).fetchone()

        if not row:
            # The user exists in Cognito but hasn't been synced to the local DB yet.
            # We will let the /sync endpoint handle the insertion.
            # But if a protected route is hit before sync, we reject.
            raise HTTPException(status_code=401, detail="User profile not synced to local database")

        user_id, username, db_role, first_name, last_name, designation = row

    return {
        "id": user_id,
        "cognito_sub_id": cognito_sub_id,
        "username": username,
        "role": computed_role, # Favor Cognito groups for role
        "designations": groups,
        "first_name": first_name,
        "last_name": last_name
    }



def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that ensures the current user has admin privileges.
    Raises 403 if the user is not an admin.
    """
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
