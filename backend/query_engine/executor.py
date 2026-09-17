import os
import json
import re
from sqlalchemy import text, create_engine
from .functions import get_kb_engine

def get_app_engine():
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    return create_engine(db_url)

def log_audit(user_id: int, query_text: str, parameters: str, step: int = 1):
    engine = get_app_engine()
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                query_text TEXT,
                parameters TEXT,
                step INTEGER,
                timestamp TIMESTAMP DEFAULT now()
            )
        """))
        try:
            conn.execute(text("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS step INTEGER"))
        except Exception:
            pass

        conn.execute(
            text("INSERT INTO audit_log (user_id, query_text, parameters, step) VALUES (:uid, :qt, :p, :s)"),
            {"uid": user_id, "qt": query_text, "p": parameters, "s": step}
        )
        conn.commit()

def execute_function(user_id: int, func_name: str, args: dict, step: int = 1) -> dict:
    """Executes the universal execute_read_only_sql tool called by the LLM."""
    
    lineage_record = {
        "step": step,
        "function": func_name,
        "arguments": args,
        "database": "finstant_kb"
    }

    if func_name != "execute_read_only_sql":
        return {"result": f"Error: Function '{func_name}' is deprecated in V2.0. You must use 'execute_read_only_sql' and write raw PostgreSQL.", "lineage": [lineage_record]}

    query_str = args.get("query", "").strip()
    if not query_str:
        return {"result": "Error: No 'query' parameter provided.", "lineage": [lineage_record]}

    # =========================================================================
    # THE REGEX FIREWALL (DEFENSE LAYER 1)
    # =========================================================================
    # Block destructive commands before they even reach the database driver.
    # Note: We use \b to match exact words, ensuring we don't block column names like 'update_date'
    destructive_keywords = [
        r'\bDROP\b', r'\bDELETE\b', r'\bUPDATE\b', r'\bINSERT\b',
        r'\bALTER\b', r'\bTRUNCATE\b', r'\bGRANT\b', r'\bREVOKE\b',
        r'\bEXECUTE\b', r'\bCOMMIT\b', r'\bCOPY\b', r'\bCREATE TABLE\b'
    ]
    
    for pattern in destructive_keywords:
        if re.search(pattern, query_str, re.IGNORECASE):
            # Tell the LLM why it failed so it can learn and rewrite using CTEs
            error_msg = f"SQL Execution Error: The Verification Firewall blocked your query because it matched the destructive pattern '{pattern}'. If you were trying to create a table, use a CTE (WITH clause) instead."
            print(f"Firewall Blocked: {pattern}")
            return {"result": error_msg, "lineage": [lineage_record]}

    # =========================================================================
    # RBAC TABLE VERIFICATION (DEFENSE LAYER 1.5)
    # =========================================================================
    import sqlglot
    from sqlglot import exp
    try:
        app_engine = get_app_engine()
        with app_engine.connect() as conn:
            user_row = conn.execute(text("SELECT role, designation FROM app_user WHERE id = :uid"), {"uid": user_id}).fetchone()
            role = user_row[0] if user_row else "user"
            user_desig = user_row[1] if user_row and len(user_row) > 1 and user_row[1] else ""
            
            if role not in ["admin", "superadmin"]:
                try:
                    user_access_rows = conn.execute(
                        text("SELECT sheet_name FROM user_sheet_access WHERE user_id = :uid"),
                        {"uid": user_id}
                    ).fetchall()
                    if user_access_rows:
                        allowed_raw = [r[0] for r in user_access_rows if r[0]]
                    else:
                        desig_access_rows = conn.execute(
                            text("SELECT sheet_name FROM designation_sheet_access WHERE LOWER(designation) = LOWER(:desig)"),
                            {"desig": user_desig}
                        ).fetchall()
                        allowed_raw = [r[0] for r in desig_access_rows if r[0]]
                    allowed_tables = set(allowed_raw)
                except Exception:
                    allowed_tables = set()
                
                kb_engine_check = get_kb_engine()
                with kb_engine_check.connect() as kb_conn:
                    actual_tables = {r[0].lower().strip() for r in kb_conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()}
                
                parsed = sqlglot.parse_one(query_str, read="postgres")
                for table in parsed.find_all(exp.Table):
                    tbl_name = table.name.lower().strip()
                    if tbl_name in actual_tables:
                        # Case/Space/Underscore insensitive match:
                        clean_tbl = re.sub(r'[^a-z0-9]', '', tbl_name).replace('and', '')
                        is_allowed = any(
                            re.sub(r'[^a-z0-9]', '', str(a).lower()).replace('and', '') == clean_tbl
                            for a in allowed_tables
                        )
                        if not is_allowed:
                            error_msg = f"Security Authorization Error: You are not authorized to query the dataset '{tbl_name}'."
                            log_audit(user_id, "execute_read_only_sql (DENIED)", json.dumps({"query": query_str, "reason": error_msg}), step)
                            return {"result": error_msg, "lineage": [lineage_record]}
    except sqlglot.errors.ParseError as e:
        # Let Postgres handle the syntax error instead of dying in sqlglot
        pass
    except Exception as e:
        print(f"RBAC check warning: {e}")

    # =========================================================================
    # EXECUTION (DEFENSE LAYER 2)
    # =========================================================================
    result_data = []
    engine = get_kb_engine()
    
    try:
        with engine.connect() as conn:
            # Execution runs under the 'finstant_kb_reader' read-only role!
            res = conn.execute(text(query_str))
            
            if res.returns_rows:
                keys = res.keys()
                result_data = [dict(zip(keys, row)) for row in res.fetchall()]
            else:
                result_data = "Query executed successfully, but returned no rows."
                
    except Exception as e:
        # Feed the exact Postgres error back to the LLM (e.g., "column does not exist")
        # so the LLM can self-correct in the multi-turn loop.
        return {"result": f"Postgres Syntax Error: {str(e)}", "lineage": [lineage_record]}

    # Audit Logging
    log_audit(user_id, func_name, json.dumps(args), step)

    if not result_data:
        return {"result": "The query executed successfully but returned zero rows. Try adjusting your WHERE clause.", "lineage": [lineage_record]}

    return {"result": result_data, "lineage": [lineage_record]}
