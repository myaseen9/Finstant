from fastapi import APIRouter, Depends, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import boto3
from sqlalchemy import text
from query_engine.executor import get_app_engine
from api.dependencies import get_current_user, get_jwks, COGNITO_REGION, USER_POOL_ID, APP_CLIENT_ID
from jose import jwt

router = APIRouter()


@router.post("/sync")
async def sync_user(request: Request):
    """
    Called by the frontend immediately after a successful Cognito login.
    Decodes the JWT and ensures the user exists in the local database.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
        
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
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    import traceback
    try:
        cognito_sub_id = claims["sub"]
        username = claims.get("email", "")
        first_name = claims.get("given_name", "User")
        last_name = claims.get("family_name", "")
        groups = claims.get("cognito:groups", [])
        
        computed_role = "superadmin" if "SuperAdmin" in groups else ("admin" if "Admin" in groups else "user")
        designation = groups[0] if groups else "User"
    
        engine = get_app_engine()
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT id, role, designation FROM app_user WHERE cognito_sub_id = :sub OR username = :uname"),
                {"sub": cognito_sub_id, "uname": username}
            ).fetchone()
    
            if not row:
                # Create user locally!
                conn.execute(
                    text("""
                        INSERT INTO app_user (username, cognito_sub_id, first_name, last_name, role, designation, is_active, created_at)
                        VALUES (:uname, :sub, :fname, :lname, :role, :desig, true, now())
                    """),
                    {
                        "uname": username, "sub": cognito_sub_id, "fname": first_name, 
                        "lname": last_name, "role": computed_role, "desig": designation
                    }
                )
                conn.commit()
            else:
                user_id, current_role, current_desig = row
                new_desig = designation if (groups and groups[0] in ["SuperAdmin", "Admin"]) else (current_desig or designation)
                conn.execute(
                    text("""
                        UPDATE app_user 
                        SET cognito_sub_id = :sub,
                            role = :role,
                            designation = :desig,
                            first_name = CASE WHEN :fname != 'User' AND :fname != '' THEN :fname ELSE first_name END,
                            last_name = CASE WHEN :lname != '' THEN :lname ELSE last_name END
                        WHERE id = :id
                    """),
                    {
                        "sub": cognito_sub_id,
                        "role": computed_role,
                        "desig": new_desig,
                        "fname": first_name,
                        "lname": last_name,
                        "id": user_id
                    }
                )
                conn.commit()
    
        return {"status": "success", "message": "User synced successfully"}
    except Exception as exc:
        err_str = traceback.format_exc()
        return JSONResponse(status_code=500, content={"detail": err_str})



@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the current authenticated user's info from the Cognito JWT & local DB."""
    return current_user


class PasswordUpdateRequest(BaseModel):

    current_password: str
    new_password: str

@router.put("/update-password")
@router.put("/api/update-password")
async def update_password(req: PasswordUpdateRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Updates user password in AWS Cognito with fallback to admin reset."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "")
    
    client = boto3.client('cognito-idp', region_name=COGNITO_REGION)
    try:
        client.change_password(
            PreviousPassword=req.current_password,
            ProposedPassword=req.new_password,
            AccessToken=token
        )
        return {"status": "success", "message": "Password updated successfully"}
    except Exception as e:
        try:
            client.admin_set_user_password(
                UserPoolId=USER_POOL_ID,
                Username=current_user.get("username"),
                Password=req.new_password,
                Permanent=True
            )
            return {"status": "success", "message": "Password updated successfully"}
        except Exception as fallback_err:
            return JSONResponse(status_code=400, content={"status": "error", "error": str(fallback_err)})


