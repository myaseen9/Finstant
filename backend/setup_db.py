import os
import urllib.parse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

load_dotenv()

def setup_databases():
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:12345678@localhost:5432/finstant_users")
    parsed = urllib.parse.urlparse(db_url)
    user = parsed.username or "postgres"
    password = parsed.password or "12345678"
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432

    print("=" * 60)
    print(" FINSTANT POSTGRESQL AUTOMATED DATABASE SETUP")
    print("=" * 60)
    print(f"Connecting to PostgreSQL at {host}:{port} as user '{user}'...")

    try:
        conn = psycopg2.connect(dbname="postgres", user=user, password=password, host=host, port=port)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        for dbname in ["finstant_users", "finstant_kb"]:
            cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{dbname}'")
            if not cur.fetchone():
                cur.execute(f"CREATE DATABASE {dbname}")
                print(f" [+] Created database: {dbname}")
            else:
                print(f" [OK] Database already exists: {dbname}")

        cur.close()
        conn.close()

        conn_kb = psycopg2.connect(dbname="finstant_kb", user=user, password=password, host=host, port=port)
        conn_kb.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur_kb = conn_kb.cursor()

        cur_kb.execute("SELECT 1 FROM pg_roles WHERE rolname = 'finstant_kb_reader'")
        if not cur_kb.fetchone():
            cur_kb.execute("CREATE USER finstant_kb_reader WITH PASSWORD 'kb_reader_secure_123'")
            print(" [+] Created read-only user: finstant_kb_reader")
        else:
            print(" [OK] Read-only user already exists: finstant_kb_reader")

        cur_kb.execute("GRANT CONNECT ON DATABASE finstant_kb TO finstant_kb_reader;")
        cur_kb.execute("GRANT USAGE ON SCHEMA public TO finstant_kb_reader;")
        cur_kb.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finstant_kb_reader;")
        print(" [OK] Configured read-only permissions on finstant_kb")

        cur_kb.close()
        conn_kb.close()

        # Connect to finstant_users and apply app_schema.sql
        conn_users = psycopg2.connect(dbname="finstant_users", user=user, password=password, host=host, port=port)
        conn_users.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur_users = conn_users.cursor()
        
        schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "db_schemas", "app_schema.sql")
        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            cur_users.execute(schema_sql)
            print(" [OK] Applied app_schema.sql to finstant_users")
        
        cur_users.close()
        conn_users.close()

        print("\n[SUCCESS] PostgreSQL database initialization complete!")

    except Exception as e:
        print(f"\n[ERROR] Setting up databases: {e}")
        print("Please ensure PostgreSQL is running and check your credentials in backend/.env")

if __name__ == "__main__":
    setup_databases()
