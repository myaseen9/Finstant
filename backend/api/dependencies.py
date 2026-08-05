import uuid
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, Depends
from sqlalchemy import text
from query_engine.executor import get_app_engine

SESSION_COOKIE_NAME = "finstant_session"
SESSION_EXPIRY_HOURS = 24


def get_current_user(request: Request) -> dict:
    """
    Reads the session cookie, validates it against the sessions table,
    and returns the authenticated user's info.
    Raises 401 if the cookie is missing, invalid, or expired.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    engine = get_app_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT s.user_id, s.expires_at, u.username, u.role, u.profile_picture
                FROM sessions s
                JOIN app_user u ON s.user_id = u.id
                WHERE s.id = :sid
            """),
            {"sid": session_id}
        ).fetchone()

        if not row:
            raise HTTPException(status_code=401, detail="Invalid session")

        user_id, expires_at, username, role, profile_picture = row

        if expires_at and datetime.utcnow() > expires_at:
            # Clean up expired session
            conn.execute(text("DELETE FROM sessions WHERE id = :sid"), {"sid": session_id})
            conn.commit()
            raise HTTPException(status_code=401, detail="Session expired")

    return {
        "id": user_id,
        "username": username,
        "role": role,
        "profile_picture": profile_picture
    }


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that ensures the current user has admin privileges.
    Raises 403 if the user is not an admin.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
