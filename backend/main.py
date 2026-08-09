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
        import logging
        # app_user MUST be created first (other tables reference it)
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS app_user (
                    id integer NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    username text NOT NULL UNIQUE,
                    password_hash text NOT NULL,
                    first_name text NOT NULL,
                    last_name text NOT NULL,
                    role text NOT NULL DEFAULT 'user'::text CHECK (role IN ('admin', 'user', 'superadmin')),
                    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    designation text NOT NULL DEFAULT 'User'::text,
                    is_active boolean NOT NULL DEFAULT true,
                    profile_picture text
                )
            """))
            # Insert default admin if 'admin' does not exist
            count = conn.execute(text("SELECT COUNT(*) FROM app_user WHERE username = 'admin'")).scalar()
            if count == 0:
                import bcrypt
                default_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
                conn.execute(text("""
                    INSERT INTO app_user (username, password_hash, first_name, last_name, role, designation, is_active)
                    VALUES ('admin', :hash, 'Admin', 'User', 'admin', 'System Administrator', true)
                """), {"hash": default_hash})
        except Exception as e:
            logging.error(f"Startup DB setup error in app_user creation: {e}")

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sessions (
                id text NOT NULL PRIMARY KEY,
                user_id integer NOT NULL,
                created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                expires_at timestamp without time zone,
                CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_session (
                id text NOT NULL PRIMARY KEY,
                user_id integer NOT NULL,
                title text,
                created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                deleted_by_user boolean DEFAULT false,
                CONSTRAINT fk_chat_session_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_message (
                id text NOT NULL PRIMARY KEY,
                session_id text NOT NULL,
                role text NOT NULL CHECK (role IN ('user', 'assistant')),
                content text,
                created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_chat_message_session FOREIGN KEY (session_id) REFERENCES chat_session(id) ON DELETE CASCADE
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
