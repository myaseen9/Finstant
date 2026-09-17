from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Form, Query, HTTPException, Depends
from fastapi.responses import FileResponse
import datetime
import os
import sys
import subprocess
import pandas as pd
from sqlalchemy import text, create_engine
from query_engine.executor import get_app_engine

from query_engine.functions import get_engine, get_kb_engine
from api.dependencies import get_current_user, require_admin

router = APIRouter()


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    replace_target: str = Query(None),
    current_user: dict = Depends(require_admin)
):
    if not file.filename.endswith(".xlsx"):
        return {"error": "Only .xlsx files are supported"}

    file_content = await file.read()
    file_size = len(file_content)

    engine = get_app_engine()
    kb_engine = get_engine()

    if not replace_target:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT id FROM file_upload WHERE filename = :fname AND status IN ('Completed', 'Ingesting') LIMIT 1"),
                {"fname": file.filename}
            ).fetchone()

            if result:
                return {
                    "status": "needs_confirmation",
                    "message": f"A file named '{file.filename}' has already been uploaded. Do you want to replace the existing data?",
                    "replace_target": file.filename
                }

    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    with engine.connect() as conn:
        if replace_target:
            conn.execute(text("UPDATE file_upload SET status = 'Replaced' WHERE filename = :rt"), {"rt": replace_target})
            tables = ["capital_expenditures", "cash_inflows", "dashboard_summary", "debt_and_interest_schedule",
                      "employee_directory", "payroll_logs", "saas_and_subscriptions", "tax_ledger",
                      "travel_and_expense", "utility_bills", "vendor_directory", "vendor_payments"]
            with kb_engine.connect() as kb_conn:
                for table in tables:
                    try:
                        kb_conn.execute(text(f"DELETE FROM {table} WHERE _source_file = :rt"), {"rt": replace_target})
                    except Exception:
                        pass
                kb_conn.commit()

        result = conn.execute(
            text("INSERT INTO file_upload (filename, size_bytes, status) VALUES (:filename, :size, 'Ingesting') RETURNING id"),
            {"filename": file.filename, "size": file_size}
        )
        file_id = result.fetchone()[0]
        conn.commit()

    def run_ingestion_pipeline(path: str, fid: int):
        ingestion_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ingestion", "run_ingestion.py")
        python_exe = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "venv", "Scripts", "python.exe")
        if not os.path.exists(python_exe):
            # Fallback for linux/mac if needed
            python_exe = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "venv", "bin", "python")
        status = "Completed"
        from dotenv import load_dotenv
        load_dotenv()
        kb_db_url = os.environ.get("KB_INGESTION_URL", os.environ.get("DATABASE_URL"))
        if kb_db_url.startswith("postgres://"):
            kb_db_url = kb_db_url.replace("postgres://", "postgresql://", 1)

        try:
            subprocess.run([python_exe, ingestion_script, path, "--db_url", kb_db_url], capture_output=True, text=True, check=True)
        except Exception as e:
            status = "Error"
            error_log_path = os.path.join(os.path.dirname(path), f"ingestion_error_{fid}.log")
            with open(error_log_path, "w") as f:
                if isinstance(e, subprocess.CalledProcessError):
                    f.write(f"STDOUT:\n{e.stdout}\n\nSTDERR:\n{e.stderr}")
                else:
                    f.write(f"EXCEPTION:\n{str(e)}")
            print(f"Ingestion failed! Check {error_log_path}")
        
        # Delete the physical file after processing (success or fail) to save space
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            print(f"Failed to delete {path}: {e}")
            
        with engine.connect() as conn:
            conn.execute(text("UPDATE file_upload SET status = :status WHERE id = :id"), {"status": status, "id": fid})
            conn.commit()

    background_tasks.add_task(run_ingestion_pipeline, file_path, file_id)
    return {"status": "success", "message": f"File {file.filename} uploaded successfully. Ingestion has started."}


@router.delete("/upload/{file_id}")
async def delete_upload(file_id: int, current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    kb_engine = get_engine()

    with engine.connect() as conn:
        result = conn.execute(text("SELECT filename FROM file_upload WHERE id = :id"), {"id": file_id}).fetchone()
        if not result:
            return {"error": "File not found"}
        filename = result[0]

    tables = ["capital_expenditures", "cash_inflows", "dashboard_summary", "debt_and_interest_schedule",
              "employee_directory", "payroll_logs", "saas_and_subscriptions", "tax_ledger",
              "travel_and_expense", "utility_bills", "vendor_directory", "vendor_payments"]
    with kb_engine.connect() as kb_conn:
        for table in tables:
            try:
                kb_conn.execute(text(f"DELETE FROM {table} WHERE _source_file = :fname"), {"fname": filename})
            except Exception:
                pass
        try:
            kb_conn.execute(text("TRUNCATE TABLE semantic_cache"))
        except Exception:
            pass
        kb_conn.commit()

    with engine.connect() as conn:
        conn.execute(text("DELETE FROM file_upload WHERE id = :id"), {"id": file_id})
        conn.commit()

    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    file_path = os.path.join(upload_dir, filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"status": "success", "message": "File and associated data deleted."}


def get_kb_ingest_engine():
    db_url = os.environ.get("KB_INGESTION_URL", os.environ.get("DATABASE_URL"))
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    return create_engine(db_url)


@router.delete("/wipe-knowledge-base")
async def wipe_knowledge_base(current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    kb_admin_engine = get_kb_ingest_engine()
    try:
        upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
        if os.path.exists(upload_dir):
            import shutil
            for item in os.listdir(upload_dir):
                item_path = os.path.join(upload_dir, item)
                if os.path.isfile(item_path) and item.endswith('.xlsx'):
                    try:
                        os.remove(item_path)
                    except:
                        pass

        with engine.connect() as conn:
            conn.execute(text("DELETE FROM file_upload"))
            conn.execute(text("DELETE FROM user_sheet_access"))
            conn.commit()

        with kb_admin_engine.execution_options(isolation_level="AUTOCOMMIT").connect() as kb_conn:
            kb_conn.execute(text("""
                DROP SCHEMA public CASCADE;
                CREATE SCHEMA public;
                GRANT USAGE ON SCHEMA public TO finstant_kb_reader;
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finstant_kb_reader;
            """))

        return {"status": "success", "message": "Knowledge base completely wiped."}
    except Exception as e:
        return {"error": str(e)}



@router.get("/download-master")
async def download_master(current_user: dict = Depends(require_admin)):
    kb_engine = get_engine()
    tables = [
        "capital_expenditures", "cash_inflows", "dashboard_summary", "debt_and_interest_schedule",
        "employee_directory", "payroll_logs", "saas_and_subscriptions", "tax_ledger",
        "travel_and_expense", "utility_bills", "vendor_directory", "vendor_payments"
    ]

    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    master_path = os.path.join(upload_dir, "Master_Financial_Dataset.xlsx")

    with pd.ExcelWriter(master_path, engine='openpyxl') as writer:
        with kb_engine.connect() as conn:
            sheets_written = 0
            for table in tables:
                try:
                    df = pd.read_sql_table(table, conn)
                    if 'id' in df.columns:
                        df = df.drop(columns=['id'])
                    sheet_name = table.replace('_', ' ').title()[:31]
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
                    sheets_written += 1
                except Exception:
                    pass

            if sheets_written == 0:
                pd.DataFrame({"Status": ["No data available"]}).to_excel(writer, sheet_name="Empty Dataset", index=False)

    return FileResponse(
        master_path,
        filename="Master_Financial_Dataset.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get("/uploads")
async def get_uploads(current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, filename, size_bytes, status, created_at FROM file_upload ORDER BY created_at DESC")
        ).fetchall()
        
        return [
            {
                "id": row[0],
                "filename": row[1],
                "size_bytes": row[2],
                "status": row[3],
                "created_at": row[4]
            }
            for row in rows
        ]


@router.delete("/clear-upload-history")
async def clear_upload_history(current_user: dict = Depends(require_admin)):
    """Clear all records from upload history without touching knowledge tables."""
    engine = get_app_engine()
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM file_upload"))
        conn.commit()
    return {"status": "success", "message": "Upload history cleared."}


from pydantic import BaseModel
import boto3
import os

COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")

@router.get("/tables")
@router.get("/admin/tables")
@router.get("/api/tables")
@router.get("/api/admin/tables")
async def get_tables(current_user: dict = Depends(require_admin)):
    """Fetch all actual tables in the finstant_kb database."""
    kb_engine = get_kb_engine()
    with kb_engine.connect() as conn:
        tables_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
        return [{"id": r[0], "name": r[0].replace('_', ' ').title()} for r in tables_res if r[0] != 'security_test']


@router.get("/live-files")
async def get_live_files(current_user: dict = Depends(require_admin)):
    """Fetch all unique source files and active sheets currently stored in finstant_kb."""
    kb_engine = get_kb_engine()
    live_files = {}
    try:
        with kb_engine.connect() as conn:
            tables_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
            for (tbl,) in tables_res:
                if tbl == 'security_test':
                    continue
                sheet_title = tbl.replace('_', ' ').title()
                try:
                    src_rows = conn.execute(text(f'SELECT DISTINCT _source_file FROM "{tbl}" WHERE _source_file IS NOT NULL')).fetchall()
                    for (src,) in src_rows:
                        if src:
                            src_str = str(src)
                            if src_str not in live_files:
                                live_files[src_str] = []
                            if sheet_title not in live_files[src_str]:
                                live_files[src_str].append(sheet_title)
                except Exception:
                    pass
    except Exception as e:
        print(f"Error fetching live files: {e}")

    result = [
        {"filename": fname, "sheets": sheets, "total_sheets": len(sheets)}
        for fname, sheets in live_files.items()
    ]
    return {"live_files": result, "total_files": len(result)}


class UpdateDesignationAccessRequest(BaseModel):
    designation: str
    sheets: list[str]

@router.get("/designation-access/{designation}")
async def get_designation_access(designation: str, current_user: dict = Depends(require_admin)):
    """Fetch the sheets granted to a specific designation."""
    engine = get_app_engine()
    with engine.connect() as conn:
        res = conn.execute(text("SELECT sheet_name FROM designation_sheet_access WHERE designation = :desig"), {"desig": designation}).fetchall()
        return [r[0] for r in res]

@router.post("/designation-access")
async def update_designation_access(req: UpdateDesignationAccessRequest, current_user: dict = Depends(require_admin)):
    """Update the sheets granted to a specific designation."""
    engine = get_app_engine()
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM designation_sheet_access WHERE designation = :desig"), {"desig": req.designation})
        for sheet in req.sheets:
            conn.execute(text("INSERT INTO designation_sheet_access (designation, sheet_name) VALUES (:desig, :sheet)"), {"desig": req.designation, "sheet": sheet})
        conn.commit()
class UpdateUserAccessRequest(BaseModel):
    user_id: int
    sheets: list[str]

@router.get("/user-access/{user_id}")
@router.get("/api/admin/user-access/{user_id}")
async def get_user_access(user_id: int, current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    with engine.connect() as conn:
        # 1. Check user-specific access
        user_rows = conn.execute(text("SELECT sheet_name FROM user_sheet_access WHERE user_id = :uid"), {"uid": user_id}).fetchall()
        if user_rows:
            return [r[0] for r in user_rows if r[0] and r[0] != '__NONE__']

        # 2. If no custom override exists yet, return designation defaults
        user_desig_row = conn.execute(text("SELECT designation FROM app_user WHERE id = :uid"), {"uid": user_id}).fetchone()
        desig = (user_desig_row[0] if user_desig_row and user_desig_row[0] else "") or ""
        if desig:
            desig_rows = conn.execute(
                text("SELECT sheet_name FROM designation_sheet_access WHERE LOWER(designation) = LOWER(:desig)"),
                {"desig": desig}
            ).fetchall()
            return [r[0] for r in desig_rows if r[0]]
        return []

@router.post("/user-access")
@router.post("/api/admin/user-access")
async def update_user_access(req: UpdateUserAccessRequest, current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM user_sheet_access WHERE user_id = :uid"), {"uid": req.user_id})
        if req.sheets:
            for sheet in req.sheets:
                conn.execute(text("INSERT INTO user_sheet_access (user_id, sheet_name) VALUES (:uid, :sheet)"), {"uid": req.user_id, "sheet": sheet})
        else:
            # Explicit empty access override
            conn.execute(text("INSERT INTO user_sheet_access (user_id, sheet_name) VALUES (:uid, '__NONE__')"), {"uid": req.user_id})
        conn.commit()
    return {"message": "User access permissions updated successfully"}

@router.get("/user-analytics/{user_id}")
@router.get("/api/admin/user-analytics/{user_id}")
async def get_user_analytics(user_id: int, current_user: dict = Depends(require_admin)):
    """Aggregates audit_log into date-grouped metrics categorized by query type."""
    engine = get_app_engine()
    with engine.connect() as conn:
        query = text("""
            SELECT 
                DATE(timestamp) as log_date,
                COUNT(*) as total_queries,
                SUM(CASE WHEN query_text ILIKE '%DENIED%' THEN 1 ELSE 0 END) as denied,
                SUM(CASE 
                    WHEN query_text NOT ILIKE '%DENIED%' AND (parameters ILIKE '%WITH %' OR parameters ILIKE '%OVER(%' OR parameters ILIKE '%RANK()%') THEN 1 
                    ELSE 0 
                END) as analytical,
                SUM(CASE 
                    WHEN query_text NOT ILIKE '%DENIED%' AND NOT (parameters ILIKE '%WITH %' OR parameters ILIKE '%OVER(%' OR parameters ILIKE '%RANK()%') AND (parameters ILIKE '%SUM(%' OR parameters ILIKE '%AVG(%' OR parameters ILIKE '%MAX(%' OR parameters ILIKE '%MIN(%' OR parameters ILIKE '%COUNT(%') THEN 1 
                    ELSE 0 
                END) as aggregations,
                SUM(CASE 
                    WHEN query_text NOT ILIKE '%DENIED%' AND NOT (parameters ILIKE '%WITH %' OR parameters ILIKE '%OVER(%' OR parameters ILIKE '%RANK()%') AND NOT (parameters ILIKE '%SUM(%' OR parameters ILIKE '%AVG(%' OR parameters ILIKE '%MAX(%' OR parameters ILIKE '%MIN(%' OR parameters ILIKE '%COUNT(%') THEN 1 
                    ELSE 0 
                END) as lookups
            FROM audit_log
            WHERE user_id = :uid
            GROUP BY DATE(timestamp)
            ORDER BY log_date DESC
        """)
        rows = conn.execute(query, {"uid": user_id}).fetchall()
        
        return [
            {
                "date": row[0].strftime("%m/%d/%Y") if hasattr(row[0], 'strftime') else (str(row[0]) if row[0] else None),
                "total": row[1],
                "denied": row[2],
                "analytical": row[3],
                "aggregations": row[4],
                "lookups": row[5]
            }
            for row in rows
        ]

@router.get("/audit-logs")
async def get_audit_logs(limit: int = 100, current_user: dict = Depends(require_admin)):
    """Returns raw audit log rows joined with app_user details for SuperAdmin inspection."""
    engine = get_app_engine()
    with engine.connect() as conn:
        query = text("""
            SELECT 
                a.id,
                a.user_id,
                u.username,
                u.first_name,
                u.role,
                a.query_text,
                a.parameters,
                a.step,
                a.timestamp
            FROM audit_log a
            LEFT JOIN app_user u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT :lim
        """)
        rows = conn.execute(query, {"lim": limit}).fetchall()
        return [
            {
                "id": r[0],
                "user_id": r[1],
                "username": r[2] or "Unknown",
                "first_name": r[3] or "User",
                "role": r[4] or "user",
                "action": r[5],
                "parameters": r[6],
                "step": r[7],
                "timestamp": r[8].isoformat() if r[8] else None
            }
            for r in rows
        ]

@router.get("/audit-logs/export")
async def export_audit_logs_csv(current_user: dict = Depends(require_admin)):
    """Exports all audit log records as a downloadable CSV spreadsheet."""
    import io, csv
    from fastapi.responses import Response

    engine = get_app_engine()
    with engine.connect() as conn:
        query = text("""
            SELECT 
                a.id,
                a.timestamp,
                u.username,
                u.role,
                a.query_text,
                a.parameters,
                a.step
            FROM audit_log a
            LEFT JOIN app_user u ON a.user_id = u.id
            ORDER BY a.id DESC
        """)
        rows = conn.execute(query).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Log ID", "Timestamp (UTC)", "Username", "Role", "Action/Status", "Query & Parameters", "Step Index"])
    for r in rows:
        writer.writerow([r[0], r[1], r[2], r[3], r[4], r[5], r[6]])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=finstant_security_audit_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


import re

def clean_dashboard_num(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = re.sub(r'[^0-9.-]', '', str(val))
    try:
        return float(s)
    except Exception:
        return 0.0

FY_MONTH_ORDER = [
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June'
]

MONTH_SHORT = {
    'july': 'Jul', 'august': 'Aug', 'september': 'Sep',
    'october': 'Oct', 'november': 'Nov', 'december': 'Dec',
    'january': 'Jan', 'february': 'Feb', 'march': 'Mar',
    'april': 'Apr', 'may': 'May', 'june': 'Jun'
}

def detect_dataset_currency(conn, source_file=None):
    try:
        from sqlalchemy import inspect
        insp = inspect(conn)
        for t in insp.get_table_names():
            cols = [c['name'].lower() for c in insp.get_columns(t)]
            col_str = ' '.join(cols)
            if 'pkr' in col_str or 'rupee' in col_str:
                return 'PKR'
            if 'usd' in col_str or '$' in col_str or 'dollar' in col_str:
                return 'USD'
            if 'eur' in col_str or 'euro' in col_str:
                return 'EUR'
            if 'gbp' in col_str or 'pound' in col_str:
                return 'GBP'
    except Exception:
        pass
    return 'PKR'

@router.get("/dashboard")
@router.get("/api/dashboard")
async def get_dashboard_metrics(year: str = Query(None), current_user: dict = Depends(get_current_user)):
    """Provides live financial overview and time-series for the Admin Dashboard."""
    kb_engine = get_kb_engine()
    
    with kb_engine.connect() as conn:
        kpi_rows = conn.execute(text("""
            SELECT _source_file, month, revenue, total_costs, gross_profit, "gp_%" as gp_percent, _row_number
            FROM kpi
            WHERE month NOT ILIKE '%Total%' AND month NOT ILIKE '%Average%'
            ORDER BY _source_file, _row_number ASC
        """)).fetchall()
        
        hc_rows = conn.execute(text("""
            SELECT _source_file, month, total_hc, _row_number
            FROM headcount_teamwise
            WHERE month NOT ILIKE '%Total%' AND month NOT ILIKE '%Average%'
            ORDER BY _source_file, _row_number ASC
        """)).fetchall()
        
        salary_rows = conn.execute(text("""
            SELECT _source_file, month, total as total_salary, _row_number
            FROM salary_teamwise
            WHERE month NOT ILIKE '%Total%' AND month NOT ILIKE '%Average%'
            ORDER BY _source_file, _row_number ASC
        """)).fetchall()

    def get_fy_label(filename):
        match = re.search(r'(20\d{2}-\d{2})', str(filename))
        return f"FY {match.group(1)}" if match else str(filename)

    fy_data_map = {}
    for r in kpi_rows:
        sf = str(r[0])
        fy = get_fy_label(sf)
        if fy not in fy_data_map:
            fy_data_map[fy] = {"fyLabel": fy, "sourceFile": sf, "months": {}}
        
        m_name = str(r[1]).strip()
        rev = clean_dashboard_num(r[2])
        costs = abs(clean_dashboard_num(r[3]))
        prof = clean_dashboard_num(r[4])
        raw_gp = clean_dashboard_num(r[5])
        gp_pct = raw_gp * 100.0 if (0.0 < raw_gp <= 1.0) else raw_gp

        fy_data_map[fy]["months"][m_name] = {
            "month": m_name,
            "shortMonth": MONTH_SHORT.get(m_name.lower(), m_name),
            "revenue": rev,
            "costs": costs,
            "profit": prof,
            "gpPercent": round(gp_pct, 2),
            "headcount": 0,
            "salary": 0
        }

    for r in hc_rows:
        fy = get_fy_label(r[0])
        m_name = str(r[1]).strip()
        if fy in fy_data_map and m_name in fy_data_map[fy]["months"]:
            fy_data_map[fy]["months"][m_name]["headcount"] = clean_dashboard_num(r[2])

    for r in salary_rows:
        fy = get_fy_label(r[0])
        m_name = str(r[1]).strip()
        if fy in fy_data_map and m_name in fy_data_map[fy]["months"]:
            fy_data_map[fy]["months"][m_name]["salary"] = abs(clean_dashboard_num(r[2]))

    available_fys = sorted(list(fy_data_map.keys()))

    if not year or year == 'All':
        annual_data = []
        grand_rev = 0.0
        grand_prof = 0.0
        grand_sal = 0.0
        all_hc = []

        for fy in available_fys:
            months_obj = fy_data_map[fy]["months"]
            tot_rev = sum(months_obj[m]["revenue"] for m in FY_MONTH_ORDER if m in months_obj)
            tot_cost = sum(months_obj[m]["costs"] for m in FY_MONTH_ORDER if m in months_obj)
            tot_prof = sum(months_obj[m]["profit"] for m in FY_MONTH_ORDER if m in months_obj)
            tot_sal = sum(months_obj[m]["salary"] for m in FY_MONTH_ORDER if m in months_obj)
            hc_list = [months_obj[m]["headcount"] for m in FY_MONTH_ORDER if m in months_obj and months_obj[m]["headcount"] > 0]
            avg_hc = round(sum(hc_list) / len(hc_list)) if hc_list else 0
            
            valid_gp_pcts = [months_obj[m]["gpPercent"] for m in months_obj if months_obj[m]["gpPercent"] > 0]
            avg_gp_pct = round(sum(valid_gp_pcts) / len(valid_gp_pcts), 2) if valid_gp_pcts else 0.0
            gp_margin = round((tot_prof / tot_rev) * 100.0, 2) if (tot_rev > 0 and tot_prof > 0) else avg_gp_pct

            annual_data.append({
                "label": fy,
                "year": fy,
                "revenue": round(tot_rev),
                "costs": round(tot_cost),
                "profit": round(tot_prof),
                "gpPercent": gp_margin,
                "headcount": avg_hc,
                "salary": round(tot_sal)
            })

            grand_rev += tot_rev
            grand_prof += tot_prof
            grand_sal += tot_sal
            if avg_hc > 0:
                all_hc.append(avg_hc)

        overall_avg_hc = round(sum(all_hc) / len(all_hc)) if all_hc else 0

        detected_currency = detect_dataset_currency(conn)

        return {
            "mode": "annual",
            "selectedYear": "All",
            "currency": detected_currency,
            "chartData": annual_data,
            "overview": {
                "total_revenue": grand_rev,
                "gross_profit": grand_prof,
                "avg_headcount": overall_avg_hc,
                "total_salary": grand_sal
            },
            "years": available_fys
        }

    # Single Year
    selected_fy = next((f for f in available_fys if year.lower() in f.lower()), available_fys[0] if available_fys else "All")
    fy_months = fy_data_map.get(selected_fy, {}).get("months", {})

    monthly_data = []
    fy_rev = 0.0
    fy_prof = 0.0
    fy_sal = 0.0
    fy_hcs = []

    for idx, m in enumerate(FY_MONTH_ORDER):
        item = fy_months.get(m, {
            "month": m,
            "shortMonth": MONTH_SHORT.get(m.lower(), m),
            "revenue": 0,
            "costs": 0,
            "profit": 0,
            "gpPercent": 0,
            "headcount": 0,
            "salary": 0
        })

        rev = round(item["revenue"])
        cost = round(item["costs"])
        prof = round(item["profit"])
        sal = round(item["salary"])
        hc = item["headcount"]
        gp_pct = item["gpPercent"]

        monthly_data.append({
            "label": item["shortMonth"],
            "month": item["shortMonth"],
            "fullMonth": m,
            "fiscalMonthIndex": idx + 1,
            "revenue": rev,
            "costs": cost,
            "profit": prof,
            "gpPercent": gp_pct,
            "headcount": hc,
            "salary": sal
        })

        fy_rev += rev
        fy_prof += prof
        fy_sal += sal
        if hc > 0:
            fy_hcs.append(hc)

    fy_avg_hc = round(sum(fy_hcs) / len(fy_hcs)) if fy_hcs else 0

    # --- Compute Quarterly Data (Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun) ---
    FY_QUARTERS = [
        {"label": "Q1 (Jul-Sep)", "months": ["July", "August", "September"]},
        {"label": "Q2 (Oct-Dec)", "months": ["October", "November", "December"]},
        {"label": "Q3 (Jan-Mar)", "months": ["January", "February", "March"]},
        {"label": "Q4 (Apr-Jun)", "months": ["April", "May", "June"]},
    ]

    quarterly_data = []
    for q in FY_QUARTERS:
        q_rev = q_cost = q_prof = q_sal = 0
        q_hcs = []
        q_gp_pcts = []
        for m in q["months"]:
            item = fy_months.get(m)
            if item:
                q_rev  += round(item.get("revenue", 0))
                q_cost += round(item.get("costs", 0))
                q_prof += round(item.get("profit", 0))
                q_sal  += round(item.get("salary", 0))
                hc = item.get("headcount", 0)
                if hc > 0:
                    q_hcs.append(hc)
                gp = item.get("gpPercent", 0)
                if gp > 0:
                    q_gp_pcts.append(gp)

        q_avg_hc  = round(sum(q_hcs) / len(q_hcs)) if q_hcs else 0
        q_gp_margin = round((q_prof / q_rev) * 100.0, 2) if q_rev > 0 and q_prof > 0 else (
            round(sum(q_gp_pcts) / len(q_gp_pcts), 2) if q_gp_pcts else 0.0
        )

        quarterly_data.append({
            "label": q["label"],
            "month": q["label"],
            "revenue": q_rev,
            "costs": q_cost,
            "profit": q_prof,
            "gpPercent": q_gp_margin,
            "headcount": q_avg_hc,
            "salary": q_sal
        })

    with kb_engine.connect() as conn:
        single_currency = detect_dataset_currency(conn, fy_data_map.get(selected_fy, {}).get("sourceFile"))

    return {
        "mode": "monthly",
        "selectedYear": selected_fy,
        "currency": single_currency,
        "chartData": monthly_data,
        "quarterlyData": quarterly_data,
        "overview": {
            "total_revenue": fy_rev,
            "gross_profit": fy_prof,
            "avg_headcount": fy_avg_hc,
            "total_salary": fy_sal
        },
        "years": available_fys
    }

