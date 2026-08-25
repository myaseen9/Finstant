import json
from sqlalchemy import create_engine
import os

def get_engine():
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    return create_engine(db_url)

def get_kb_engine():
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.environ.get("KB_DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    return create_engine(db_url)

WHITELISTED_FUNCTIONS = {
    "execute_read_only_sql": {
        "description": "Executes a read-only SQL query against the Postgres database. Use CTEs for complex logic.",
        "parameters": {
            "query": "The raw SQL query string to execute. MUST be a SELECT statement."
        }
    }
}

def validate_function_call(func_name: str, args: dict, schema_context: dict) -> bool:
    """Basic validation to ensure the tool is correct."""
    if func_name not in WHITELISTED_FUNCTIONS:
        return False
    if "query" not in args:
        return False
    return True
