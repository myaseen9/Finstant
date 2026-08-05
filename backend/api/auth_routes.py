from fastapi import APIRouter, Form, UploadFile, File, Depends, Response, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import uuid
from datetime import datetime, timedelta
import bcrypt
from sqlalchemy import text
from query_engine.executor import get_app_engine
from api.dependencies import get_current_user, SESSION_COOKIE_NAME, SESSION_EXPIRY_HOURS

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(req: LoginRequest):
    engine = get_app_engine()
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT id, username, password_hash, role, profile_picture FROM app_user WHERE username = :uname"),
            {"uname": req.username.lower()}
        ).fetchone()

        if not user:
            return JSONResponse(status_code=401, content={"message": "Invalid username or password"})

        user_id, username, password_hash, role, profile_picture = user

        if not bcrypt.checkpw(req.password.encode(), password_hash.encode()):
            return JSONResponse(status_code=401, content={"message": "Invalid username or password"})

        # Create session
        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=SESSION_EXPIRY_HOURS)

        conn.execute(
            text("INSERT INTO sessions (id, user_id, expires_at) VALUES (:sid, :uid, :exp)"),
            {"sid": session_id, "uid": user_id, "exp": expires_at}
        )
        conn.commit()

    response = JSONResponse(content={
        "id": user_id,
        "username": username,
        "role": role,
        "profile_picture": profile_picture
    })
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_EXPIRY_HOURS * 3600,
        path="/"
    )
    return response


@router.post("/logout")
async def logout(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        engine = get_app_engine()
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM sessions WHERE id = :sid"), {"sid": session_id})
            conn.commit()

    response = JSONResponse(content={"status": "success"})
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return response


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the current authenticated user's info from the session cookie."""
    return current_user


@router.put("/update-password")
async def update_password(req: PasswordUpdateRequest, current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT password_hash FROM app_user WHERE id = :uid"),
            {"uid": current_user["id"]}
        ).fetchone()
        if not user:
            return {"error": "User not found"}

        if not bcrypt.checkpw(req.current_password.encode(), user[0].encode()):
            return {"error": "Incorrect current password"}

        new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
        conn.execute(
            text("UPDATE app_user SET password_hash = :hash WHERE id = :uid"),
            {"hash": new_hash, "uid": current_user["id"]}
        )
        conn.commit()
    return {"status": "success", "message": "Password updated successfully"}


@router.post("/upload-profile")
async def upload_profile(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    profile_upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "profiles")
    os.makedirs(profile_upload_dir, exist_ok=True)

    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
        return {"error": "Invalid file type"}

    ext = file.filename.split('.')[-1]
    filename = f"user_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(profile_upload_dir, filename)

    file_content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    profile_url = f"http://localhost:8000/profiles/{filename}"

    engine = get_app_engine()
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE app_user SET profile_picture = :url WHERE id = :uid"),
            {"url": profile_url, "uid": current_user["id"]}
        )
        conn.commit()

    return {"status": "success", "profile_url": profile_url}
