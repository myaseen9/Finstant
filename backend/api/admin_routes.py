from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Form, Query, HTTPException, Depends
from fastapi.responses import FileResponse
import os
import sys
import subprocess
import pandas as pd
from sqlalchemy import text
from query_engine.executor import get_app_engine
from query_engine.functions import get_engine
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
        python_exe = sys.executable
        status = "Completed"
        from dotenv import load_dotenv
        load_dotenv()
        kb_db_url = os.environ.get("KB_DATABASE_URL", os.environ.get("DATABASE_URL"))
        if kb_db_url.startswith("postgres://"):
            kb_db_url = kb_db_url.replace("postgres://", "postgresql://", 1)

        try:
            subprocess.run([python_exe, ingestion_script, path, "--db_url", kb_db_url], capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            status = "Error"
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
        kb_conn.commit()

    with engine.connect() as conn:
        conn.execute(text("DELETE FROM file_upload WHERE id = :id"), {"id": file_id})
        conn.commit()

    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    file_path = os.path.join(upload_dir, filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"status": "success", "message": "File and associated data deleted."}


@router.delete("/wipe-knowledge-base")
async def wipe_knowledge_base(current_user: dict = Depends(require_admin)):
    engine = get_app_engine()
    kb_engine = get_engine()
    try:
        upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
        if os.path.exists(upload_dir):
            import shutil
            shutil.rmtree(upload_dir)
            os.makedirs(upload_dir)

        with engine.connect() as conn:
            conn.execute(text("DELETE FROM file_upload"))
            conn.commit()

        with kb_engine.execution_options(isolation_level="AUTOCOMMIT").connect() as kb_conn:
            kb_conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))

        return {"status": "success", "message": "Knowledge base completely wiped."}
    except Exception as e:
        return {"error": str(e)}


@router.get("/download/{filename}")
async def download_file(filename: str, current_user: dict = Depends(require_admin)):
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    file_path = os.path.join(upload_dir, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename)
    return {"error": "File not found"}


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

    return FileResponse(master_path, filename="Master_Financial_Dataset.xlsx")


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
