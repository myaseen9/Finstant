from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from sqlalchemy import text
from query_engine.executor import get_app_engine
from query_engine.functions import get_engine
from query_engine.translator import run_query_loop
from response.formatter import format_response
from api.dependencies import get_current_user

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    session_id: str


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    kb_engine = get_engine()
    user_id = current_user["id"]

    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT count(*) FROM file_upload WHERE status IN ('Completed', 'Ingesting')")).scalar()
            if result == 0:
                return ChatResponse(answer="No data is currently available in the Knowledge Base", session_id=request.session_id or "")
        except Exception:
            return ChatResponse(answer="No data is currently available in the Knowledge Base", session_id=request.session_id or "")

    session_id = request.session_id

    with engine.connect() as conn:
        if not session_id:
            session_id = str(uuid.uuid4())
            title = request.message[:30] + "..." if len(request.message) > 30 else request.message
            conn.execute(
                text("INSERT INTO chat_session (id, user_id, title) VALUES (:id, :user_id, :title)"),
                {"id": session_id, "user_id": user_id, "title": title}
            )
            conn.commit()

    schema_context = {}
    with kb_engine.connect() as conn:
        tables_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
        for r in tables_res:
            tbl = r[0]
            cols_res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name=:tbl"), {"tbl": tbl}).fetchall()
            schema_context[tbl] = [c[0] for c in cols_res]

    created_tables = []
    try:
        loop_result = run_query_loop(user_id, request.message, schema_context)
        created_tables = loop_result.get("created_tables", [])

        if loop_result.get("error"):
            answer = loop_result.get("final_text")
        else:
            answer = format_response(loop_result)

    except Exception as e:
        print(f"Execution error: {e}")
        answer = "An error occurred while executing the query."
    finally:
        if created_tables:
            with kb_engine.connect() as conn:
                for temp_tbl in created_tables:
                    try:
                        conn.execute(text(f'DROP TABLE IF EXISTS "{temp_tbl}"'))
                        conn.commit()
                    except Exception as e:
                        print(f"Failed to drop temp table {temp_tbl}: {e}")

    with engine.connect() as conn:
        conn.execute(
            text("INSERT INTO chat_message (id, session_id, role, content) VALUES (:id1, :sid, 'user', :content), (:id2, :sid, 'assistant', :answer)"),
            {"id1": str(uuid.uuid4()), "id2": str(uuid.uuid4()), "sid": session_id, "content": request.message, "answer": answer}
        )
        conn.commit()

    return ChatResponse(answer=answer, session_id=session_id)


@router.get("/chats")
async def get_chats(current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    user_id = current_user["id"]
    with engine.connect() as conn:
        try:
            rows = conn.execute(
                text("SELECT id, title, created_at FROM chat_session WHERE user_id = :uid AND (deleted_by_user IS NULL OR deleted_by_user = False) ORDER BY created_at DESC"),
                {"uid": user_id}
            ).fetchall()
        except Exception:
            rows = conn.execute(
                text("SELECT id, title, created_at FROM chat_session WHERE user_id = :uid ORDER BY created_at DESC"),
                {"uid": user_id}
            ).fetchall()
        return [{"id": str(r[0]), "title": r[1], "created_at": r[2]} for r in rows]


@router.get("/chats/{session_id}")
async def get_chat_history(session_id: str, current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    with engine.connect() as conn:
        # Verify the chat belongs to the current user
        owner = conn.execute(
            text("SELECT user_id FROM chat_session WHERE id = :sid"),
            {"sid": session_id}
        ).fetchone()
        if not owner or owner[0] != current_user["id"]:
            raise HTTPException(status_code=404, detail="Chat not found")

        rows = conn.execute(
            text("SELECT id, role, content FROM chat_message WHERE session_id = :sid ORDER BY created_at ASC"),
            {"sid": session_id}
        ).fetchall()
        return [{"id": str(r[0]), "role": r[1], "text": r[2]} for r in rows]


@router.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Soft-deletes a chat. Only the owning user can delete their own chats."""
    engine = get_app_engine()
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE chat_session ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN DEFAULT False"))
            result = conn.execute(
                text("UPDATE chat_session SET deleted_by_user = True WHERE id = :id AND user_id = :uid"),
                {"id": chat_id, "uid": current_user["id"]}
            )
            conn.commit()
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Chat not found")
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error soft deleting chat: {e}")
            return {"error": "Failed to delete chat"}
    return {"status": "success", "message": "Chat deleted"}
