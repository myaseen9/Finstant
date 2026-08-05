from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from api.auth_routes import router as auth_router
from api.admin_routes import router as admin_router
from api.chat_routes import router as chat_router
from query_engine.executor import get_app_engine
from sqlalchemy import text

app = FastAPI(title="Finance Knowledge Engine API")

profile_upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "profiles")
os.makedirs(profile_upload_dir, exist_ok=True)
app.mount("/profiles", StaticFiles(directory=profile_upload_dir), name="profiles")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    engine = get_app_engine()
    with engine.connect() as conn:
        # app_user MUST be created first (other tables reference it)
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS app_user (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE,
                    password_hash TEXT,
                    role TEXT,
                    profile_picture TEXT
                )
            """))
            # Insert default admin if no users exist
            count = conn.execute(text("SELECT COUNT(*) FROM app_user")).scalar()
            if count == 0:
                import bcrypt
                default_hash = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode()
                conn.execute(text("INSERT INTO app_user (id, username, password_hash, role) VALUES (1, 'admin', :hash, 'admin')"), {"hash": default_hash})
        except Exception:
            pass

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT now(),
                expires_at TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_session (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                title TEXT,
                deleted_by_user BOOLEAN DEFAULT False,
                created_at TIMESTAMP DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_message (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES chat_session(id) ON DELETE CASCADE,
                role TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT now()
            )
        """))

        try:
            conn.execute(text("ALTER TABLE app_user ADD COLUMN IF NOT EXISTS profile_picture TEXT"))
            conn.execute(text("ALTER TABLE chat_session ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN DEFAULT False"))
        except Exception:
            pass
        conn.commit()

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(chat_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
