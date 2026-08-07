import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from query_engine.executor import get_app_engine
from sqlalchemy import text
import bcrypt

engine = get_app_engine()
with engine.connect() as conn:
    existing = conn.execute(text("SELECT id FROM app_user WHERE username = 'ahmad'")).scalar()
    hash_pw = bcrypt.hashpw(b"ahmad", bcrypt.gensalt()).decode()
    if existing:
        conn.execute(text("UPDATE app_user SET password_hash = :hash, role = 'admin' WHERE username = 'ahmad'"), {"hash": hash_pw})
    else:
        conn.execute(text("INSERT INTO app_user (username, password_hash, role, first_name, last_name, designation, is_active) VALUES ('ahmad', :hash, 'admin', 'Ahmad', 'Admin', 'Administrator', true)"), {"hash": hash_pw})
    conn.commit()
print("User 'ahmad' registered as admin successfully!")
