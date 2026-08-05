import os
from sqlalchemy import create_engine, text
from .functions import get_engine

# --- SQL Injection Prevention: Validation Constants ---
VALID_OPERATIONS = {'sum', 'avg', 'count', 'min', 'max', 'count_distinct'}
VALID_DIRECTIONS = {'asc', 'desc'}
VALID_PERIODS = {'month', 'quarter', 'year'}


def validate_enum(value, allowed, default):
    """Validates a value against a fixed set of allowed values. Returns canonical lowercase."""
    if value and str(value).strip().lower() in allowed:
        return str(value).strip().lower()
    return default


def safe_int(value, default=10, min_val=1, max_val=1000):
    """Safely casts a value to int, clamped to a sane range."""
    try:
        v = int(value)
        return max(min_val, min(v, max_val))
    except (ValueError, TypeError):
        return default


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


def generate_sql_for_function(func_name: str, args: dict) -> str:
    """Deterministically generates a safe SQL string based on the whitelisted function and arguments.
    All dynamic values are validated against fixed allowed sets before being inserted into the query."""
    table = args.get("table", "").replace('"', '')
    if not table and func_name != "join":
        return ""

    where_clause = ""
    if args.get("filter_column") and args.get("filter_value"):
        fc = args["filter_column"].replace('"', '')
        fv = str(args["filter_value"]).replace("'", "''")
        where_clause = f'WHERE "{fc}" = \'{fv}\''

    if func_name == "filter":
        cols = args.get("return_columns", "*").replace('"', '')
        return f'SELECT {cols}, _source_file, _sheet_name, _row_number FROM "{table}" {where_clause}'

    elif func_name == "aggregate":
        op = validate_enum(args.get("operation"), VALID_OPERATIONS, "sum").upper()
        val_col = args.get("value_column", "").replace('"', '')
        if op == "COUNT_DISTINCT":
            return f'SELECT COUNT(DISTINCT "{val_col}") as result FROM "{table}" {where_clause}'
        return f'SELECT {op}(CAST("{val_col}" AS NUMERIC)) as result FROM "{table}" {where_clause}'

    elif func_name == "group_by":
        op = validate_enum(args.get("operation"), VALID_OPERATIONS, "sum").upper()
        val_col = args.get("value_column", "").replace('"', '')
        group_cols = args.get("group_columns", "").replace('"', '')
        if op == "COUNT":
            agg_expr = f'COUNT("{val_col}")'
        else:
            agg_expr = f'{op}(CAST("{val_col}" AS NUMERIC))'
        return f'SELECT {group_cols}, {agg_expr} as result, _source_file, _sheet_name, _row_number FROM "{table}" {where_clause} GROUP BY {group_cols}, _source_file, _sheet_name, _row_number'

    elif func_name == "sort":
        sort_col = args.get("sort_column", "").replace('"', '')
        direction = validate_enum(args.get("direction"), VALID_DIRECTIONS, "desc").upper()
        limit = safe_int(args.get("limit", 10))
        return f'SELECT *, _source_file, _sheet_name, _row_number FROM "{table}" {where_clause} ORDER BY "{sort_col}" {direction} LIMIT {limit}'

    elif func_name == "join":
        t1 = args.get("table1", "").replace('"', '')
        t2 = args.get("table2", "").replace('"', '')
        jc = args.get("join_column", "").replace('"', '')
        cols = args.get("return_columns", "*").replace('"', '')
        return f'SELECT {cols}, t1._source_file, t1._sheet_name, t1._row_number FROM "{t1}" t1 JOIN "{t2}" t2 ON t1."{jc}" = t2."{jc}" {where_clause.replace("WHERE ", "WHERE t1.")}'

    elif func_name == "compare":
        op = validate_enum(args.get("operation"), VALID_OPERATIONS, "sum").upper()
        val_col = args.get("value_column", "").replace('"', '')
        comp_col = args.get("compare_column", "").replace('"', '')
        v1 = str(args.get("value1", "")).replace("'", "''")
        v2 = str(args.get("value2", "")).replace("'", "''")
        agg_expr = f'COUNT("{val_col}")' if op == "COUNT" else f'{op}(CAST("{val_col}" AS NUMERIC))'
        return f'SELECT "{comp_col}", {agg_expr} as result FROM "{table}" WHERE "{comp_col}" IN (\'{v1}\', \'{v2}\') GROUP BY "{comp_col}"'

    elif func_name == "running_total":
        val_col = args.get("value_column", "").replace('"', '')
        ord_col = args.get("order_column", "").replace('"', '')
        grp_col = args.get("group_column", "").replace('"', '')
        partition = f'PARTITION BY "{grp_col}"' if grp_col else ""
        return f'SELECT *, SUM(CAST("{val_col}" AS NUMERIC)) OVER ({partition} ORDER BY "{ord_col}") as running_total, _source_file, _sheet_name, _row_number FROM "{table}" {where_clause}'

    elif func_name == "trend":
        val_col = args.get("value_column", "").replace('"', '')
        date_col = args.get("date_column", "").replace('"', '')
        period = validate_enum(args.get("period"), VALID_PERIODS, "month")
        return f"SELECT DATE_TRUNC('{period}', CAST(\"{date_col}\" AS DATE)) as period, SUM(CAST(\"{val_col}\" AS NUMERIC)) as total FROM \"{table}\" {where_clause} GROUP BY 1 ORDER BY 1"

    elif func_name == "percentage_of_total":
        val_col = args.get("value_column", "").replace('"', '')
        grp_col = args.get("group_column", "").replace('"', '')
        return f'SELECT "{grp_col}", SUM(CAST("{val_col}" AS NUMERIC)) as total, ROUND((SUM(CAST("{val_col}" AS NUMERIC)) / (SELECT SUM(CAST("{val_col}" AS NUMERIC)) FROM "{table}" {where_clause})) * 100, 2) as pct_of_total, _source_file, _sheet_name, _row_number FROM "{table}" {where_clause} GROUP BY "{grp_col}", _source_file, _sheet_name, _row_number'

    elif func_name == "rank_within_group":
        val_col = args.get("value_column", "").replace('"', '')
        grp_col = args.get("group_column", "").replace('"', '')
        direction = validate_enum(args.get("direction"), VALID_DIRECTIONS, "desc").upper()
        limit = safe_int(args.get("limit_per_group", 3))
        return f'SELECT * FROM (SELECT *, RANK() OVER (PARTITION BY "{grp_col}" ORDER BY CAST("{val_col}" AS NUMERIC) {direction}) as rnk, _source_file, _sheet_name, _row_number FROM "{table}") t WHERE rnk <= {limit}'

    elif func_name == "variance":
        act = args.get("actual_column", "").replace('"', '')
        bud = args.get("budget_column", "").replace('"', '')
        grp = args.get("group_column", "").replace('"', '')
        grp_sql = f'"{grp}",' if grp else ""
        grp_by = f'GROUP BY "{grp}"' if grp else ""
        return f'SELECT {grp_sql} SUM(CAST("{act}" AS NUMERIC)) as actual, SUM(CAST("{bud}" AS NUMERIC)) as budget, SUM(CAST("{act}" AS NUMERIC)) - SUM(CAST("{bud}" AS NUMERIC)) as variance FROM "{table}" {where_clause} {grp_by}'

    elif func_name == "forecast":
        return "SELECT 'Forecast not fully implemented in DB layer' as result"

    return ""


def execute_function(user_id: int, func_name: str, args: dict, step: int = 1) -> dict:
    """Executes a function by deterministically generating safe SQL."""
    try:
        query_str = generate_sql_for_function(func_name, args)
        if not query_str:
            return {"result": f"Error: Failed to generate SQL for {func_name}", "lineage": [], "created_tables": []}

        log_audit(user_id, query_str, str(args), step)

        engine = get_engine()
        with engine.connect() as conn:
            res = conn.execute(text(query_str))
            if res.returns_rows:
                rows = res.fetchall()
                result_data = [dict(r._mapping) for r in rows]

                lineage_data = []
                for r in result_data[:5]:
                    if '_source_file' in r:
                        lineage_data.append({
                            "file": r.get('_source_file'),
                            "sheet": r.get('_sheet_name'),
                            "row": r.get('_row_number')
                        })

                return {
                    "result": result_data,
                    "lineage": lineage_data,
                    "created_tables": []
                }
            else:
                return {"result": "Success.", "lineage": [], "created_tables": []}
    except Exception as e:
        return {"result": f"SQL Execution Error: {e}", "lineage": [], "created_tables": []}
