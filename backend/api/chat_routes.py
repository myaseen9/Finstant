from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
import json
import traceback
from sqlalchemy import text
from query_engine.executor import get_app_engine, log_audit
from query_engine.functions import get_kb_engine
from query_engine.translator import run_query_loop
from query_engine.fast_router import prune_schema, check_semantic_cache, save_to_semantic_cache, direct_financial_fast_route, get_grounded_entities
from response.formatter import format_response
from api.dependencies import get_current_user

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    session_id: str


def extract_context_anchor_from_history(chat_history: list, current_message: str) -> tuple:
    """
    Extracts active financial metric, table, and reference period from recent conversation turns.
    Returns: (contextual_query_for_pruning, final_anchored_user_prompt)
    """
    import re
    if not chat_history:
        return current_message, current_message

    last_assistant_msg = next((m["content"] for m in reversed(chat_history) if m["role"] == "assistant"), "")
    last_user_msg = next((m["content"] for m in reversed(chat_history) if m["role"] == "user"), "")

    if not last_assistant_msg:
        return f"{last_user_msg} | {current_message}", current_message

    q_lower = current_message.lower().strip()
    followup_signals = [
        'average', 'avg', 'mean', 'last', 'past', 'what about', 'how about',
        'and for', 'breakdown', 'show breakdown', 'compare', 'trend',
        'previous', 'next', 'for that', 'in that', 'of that', 'percentage',
        'highest', 'lowest', 'total for', 'and profit', 'and revenue', 'months', 'quarters'
    ]
    is_followup = any(sig in q_lower for sig in followup_signals)

    known_metrics = [
        'travel & leap expenses', 'travel & leap', 'travel expenses',
        'software revenue', 'total net revenue', 'net revenue', 'revenue',
        'salaries cgs', 'salaries', 'monthly payroll', 'payroll',
        'gross profit margin %', 'gross profit margin', 'gross profit %', 'gross profit', 'gp %', 'gp margin', 'gp%', 'gp', 'total costs',
        'total opex', 'operating expenses', 'rent', 'electricity', 'legal',
        'headcount', 'closing headcount', 'total headcount', 'ebitda'
    ]
    has_explicit_metric = any(m in q_lower for m in known_metrics)

    if is_followup and not has_explicit_metric:
        found_metric = None
        for m in known_metrics:
            if m in last_assistant_msg.lower():
                found_metric = m.title()
                break
        
        fy_match = re.search(r'(FY_\d{4}-\d{2}[^,\.\s]*|FY \d{4}-\d{2}|\d{4}-\d{2})', last_assistant_msg, re.IGNORECASE)
        found_fy = fy_match.group(1) if fy_match else None

        month_match = re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\b', last_assistant_msg, re.IGNORECASE)
        found_month = month_match.group(1) if month_match else None

        if found_metric:
            anchor_parts = [f"Active Metric='{found_metric}'"]
            anchor_parts.append("Table='p&l'" if any(x in found_metric.lower() for x in ['travel', 'software', 'revenue', 'salaries', 'opex', 'cost']) else "Table='kpi'")
            if found_fy:
                anchor_parts.append(f"Target Period='{found_fy}'")
            if found_month:
                anchor_parts.append(f"Reference Month='{found_month}'")

            anchor_str = f"[ACTIVE CONVERSATION CONTEXT: {', '.join(anchor_parts)}]"
            contextual_query = f"{found_metric} {' '.join(anchor_parts)} {current_message}"
            final_user_prompt = f"{anchor_str}\nUser Question: {current_message}"
            return contextual_query, final_user_prompt

    contextual_query = f"{last_user_msg} | {current_message}" if last_user_msg else current_message
    return contextual_query, current_message


GENERIC_IDENTITY_RESPONSE = (
    "I'm Finstant, your financial data assistant. "
    "Ask me a question about your organization's uploaded financial data — "
    "for example, revenue, expenses, payroll, or headcount — "
    "and I'll give you a direct answer sourced from your records."
)

UNIVERSAL_OUT_OF_SCOPE_REFUSAL = (
    "Sorry, I cannot respond to this query. Ask me only questions related to your financial data uploaded."
)

def is_identity_query(clean_msg: str) -> bool:
    """
    Catches bare product name, self-descriptions, capabilities, and infrastructure inquiries.
    """
    clean_stripped = re.sub(r'[^a-zA-Z0-9\s]', '', clean_msg).strip()
    if clean_stripped in ["finstant", "about finstant", "hi finstant", "hello finstant", "hey finstant", "finstant assistant"]:
        return True
    
    identity_phrases = [
        "who are you", "what are you", "who built you", "who made you", "who created you",
        "introduce yourself", "tell me about yourself", "what can you do", "how do you work",
        "what is your name", "what are your capabilities", "what is finstant", "what do you do",
        "help me", "what database", "which database", "database version", "what ai model",
        "which model", "what llm", "are you using aws", "what is your stack", "how are you built",
        "what server", "backend architecture", "what technology", "tech stack", "your tech stack"
    ]
    return any(p in clean_msg for p in identity_phrases)

def is_out_of_scope_query(clean_msg: str) -> bool:
    """
    Universal scope gate: rejects general non-financial queries identically for ALL roles.
    """
    out_of_scope_keywords = [
        "poem", "joke", "recipe", "weather", "translate", "write code", "coding",
        "write a script", "write python", "capital of", "who is", "story", "song",
        "essay", "trivia", "movie", "science", "sports", "president of", "prime minister",
        "country", "gaming", "philosophy", "history", "politics", "horoscope", "astrology",
        "how to cook", "fitness advice", "medical advice"
    ]
    return any(k in clean_msg for k in out_of_scope_keywords)


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    kb_engine = get_kb_engine()
    user_id = current_user["id"]

    clean_msg = request.message.strip().lower()

    # LAYER 0: Identity / Self-description Pre-Filter (Runs before role/RBAC check)
    if is_identity_query(clean_msg):
        return ChatResponse(
            answer=GENERIC_IDENTITY_RESPONSE,
            session_id=request.session_id or str(uuid.uuid4())
        )

    # LAYER 0: Universal Out-of-Scope Scope Gate (Applies identically to ALL roles: user, admin, superadmin)
    if is_out_of_scope_query(clean_msg):
        return ChatResponse(
            answer=UNIVERSAL_OUT_OF_SCOPE_REFUSAL,
            session_id=request.session_id or str(uuid.uuid4())
        )

    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT count(*) FROM file_upload WHERE status IN ('Completed', 'Ingesting')")).scalar()
            if result == 0:
                with kb_engine.connect() as kb_conn:
                    kb_tables = kb_conn.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")).scalar()
                if kb_tables == 0:
                    return ChatResponse(answer="No financial data is currently uploaded in the Knowledge Base. Please upload your financial Excel file in the Data Management panel to begin.", session_id=request.session_id or "")
        except Exception:
            pass

    session_id = request.session_id

    chat_history = []
    with engine.connect() as conn:
        if not session_id:
            session_id = str(uuid.uuid4())
            title = request.message[:30] + "..." if len(request.message) > 30 else request.message
            conn.execute(
                text("INSERT INTO chat_session (id, user_id, title) VALUES (:id, :user_id, :title)"),
                {"id": session_id, "user_id": user_id, "title": title}
            )
            conn.commit()
        else:
            # Fetch existing chat history for context
            rows = conn.execute(
                text("SELECT role, content FROM chat_message WHERE session_id = :sid ORDER BY created_at ASC"),
                {"sid": session_id}
            ).fetchall()
            chat_history = [{"role": r[0], "content": r[1]} for r in rows]
            
            # Keep up to the last 4 full turns (8 messages)
            if len(chat_history) > 8:
                chat_history = chat_history[-8:]

    schema_context = {}
    allowed_tables = set()
    
    if current_user.get("role") in ["admin", "superadmin"]:
        pass
    else:
        with engine.connect() as conn:
            access_res = conn.execute(text("SELECT sheet_name FROM user_sheet_access WHERE user_id = :uid"), {"uid": user_id}).fetchall()
            allowed_tables = {r[0] for r in access_res}

    with kb_engine.connect() as conn:
        tables_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
        for r in tables_res:
            tbl = r[0]
            if current_user.get("role") not in ["admin", "superadmin"] and tbl not in allowed_tables:
                continue
            if tbl == 'security_test':
                continue

            cols_res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name=:tbl"), {"tbl": tbl}).fetchall()
            schema_context[tbl] = [c[0] for c in cols_res]

    created_tables = []
    try:
        # Build contextual anchor query for accurate multi-turn schema pruning & LLM resolution
        contextual_query, anchored_user_prompt = extract_context_anchor_from_history(chat_history, request.message)

        # Dynamic Semantic Entity Grounding (< 3ms)
        grounded = get_grounded_entities(request.message, kb_engine)
        if grounded:
            grounded_hints = [f"Canonical '{g['canonical_name']}' in table '{g['table']}'" for g in grounded]
            print(f"[SEMANTIC GROUNDING]: Grounded user query into {grounded_hints}")
            anchored_user_prompt = f"[DATABASE ENTITY GROUNDING: {'; '.join(grounded_hints)}]\n{anchored_user_prompt}"
            contextual_query = f"{' '.join([g['canonical_name'] + ' ' + g['table'] for g in grounded])} {contextual_query}"

        # LAYER 0: Instant RBAC Authorization Guard (< 2ms)
        if current_user.get("role") not in ["admin", "superadmin"]:
            if grounded:
                grounded_tables = {g['table'] for g in grounded if g.get('table')}
                if grounded_tables and not any(t in allowed_tables for t in grounded_tables):
                    print(f"[RBAC GUARD] Blocked unauthorized access attempt to {grounded_tables}")
                    log_audit(user_id, "execute_read_only_sql (DENIED)", json.dumps({"query": request.message, "reason": "RBAC restriction"}))
                    return ChatResponse(answer="You do not have access to this data.", session_id=session_id)

        # 1. Check Semantic Cache ($0.00 cost) — only for standalone queries
        cached_answer = None
        if not chat_history:
            cached_answer = check_semantic_cache(request.message, engine)

        if cached_answer:
            print(f"CACHE HIT! Returning formatted answer.")
            answer = cached_answer
            log_audit(user_id, "execute_read_only_sql (CACHE)", json.dumps({"query": request.message}))
        else:
            # 1.5 Sub-50ms Fast Router Tier (Instant Lookup / Aggregation for standalone queries)
            is_adm = current_user.get("role") in ["admin", "superadmin"]
            fast_res = None
            if not chat_history:
                fast_res = direct_financial_fast_route(request.message, kb_engine, allowed_tables=allowed_tables, is_admin=is_adm)
            
            if fast_res and fast_res.get("matched"):
                print("[FAST ROUTER] HIT: Returning sub-50ms exact answer.")
                answer = fast_res["answer"]
                log_audit(user_id, "execute_read_only_sql", json.dumps({"query": fast_res.get("sql", request.message)}))
                save_to_semantic_cache(request.message, answer, engine)
            else:
                # 2. Dynamically prune the full database schema to relevant tables using contextual query
                pruned_schema_context = prune_schema(contextual_query, schema_context, top_k=4)
                print(f"Pruned Schema size from {len(schema_context)} down to {len(pruned_schema_context)} tables")
                
                loop_result = run_query_loop(user_id, anchored_user_prompt, pruned_schema_context, chat_history=chat_history)
                created_tables = loop_result.get("created_tables", [])
        
                if loop_result.get("error"):
                    answer = loop_result.get("final_text")
                else:
                    answer = format_response(loop_result)
                    
                    if loop_result.get("lineage") and not chat_history:
                        save_to_semantic_cache(request.message, answer, engine)

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
@router.get("/api/chats")
async def get_chats(current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    user_id = current_user["id"]
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, title, created_at FROM chat_session WHERE user_id = :uid OR user_id = :uid_str ORDER BY created_at DESC"),
            {"uid": user_id, "uid_str": str(user_id)}
        ).fetchall()
        return [{"id": str(r[0]), "title": r[1], "created_at": r[2]} for r in rows]

@router.get("/reports")
@router.get("/api/reports")
async def get_reports(current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    user_id = current_user["id"]
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT m.id, m.content, m.created_at, s.title, s.id as session_id 
                FROM chat_message m 
                JOIN chat_session s ON m.session_id = s.id 
                WHERE (s.user_id = :uid OR s.user_id = :uid_str)
                  AND m.role = 'assistant' 
                  AND m.content LIKE '%<!-- SHOW_PDF_BUTTON -->%' 
                ORDER BY m.created_at DESC
            """),
            {"uid": user_id, "uid_str": str(user_id)}
        ).fetchall()
            
        return [
            {
                "id": str(r[0]), 
                "content": r[1], 
                "created_at": r[2], 
                "chat_title": r[3],
                "session_id": str(r[4])
            } 
            for r in rows
        ]


@router.get("/chats/{session_id}")
@router.get("/api/chats/{session_id}")
async def get_chat_history(session_id: str, current_user: dict = Depends(get_current_user)):
    engine = get_app_engine()
    with engine.connect() as conn:
        owner = conn.execute(
            text("SELECT user_id FROM chat_session WHERE id = :sid"),
            {"sid": session_id}
        ).fetchone()
        
        # If session exists and user is not admin and not owner, restrict
        if owner and str(owner[0]) != str(current_user["id"]) and current_user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Forbidden")

        rows = conn.execute(
            text("SELECT id, role, content FROM chat_message WHERE session_id = :sid ORDER BY created_at ASC"),
            {"sid": session_id}
        ).fetchall()
        return [{"id": str(r[0]), "role": r[1], "text": r[2]} for r in rows]


@router.delete("/chats/{chat_id}")
@router.delete("/chat/{chat_id}")
@router.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Permanently deletes a chat session and all its messages and generated reports."""
    engine = get_app_engine()
    user_id = current_user["id"]
    is_admin = current_user.get("role") in ["admin", "superadmin"]

    with engine.connect() as conn:
        try:
            # 1. Permanently delete all messages for this session
            conn.execute(
                text("DELETE FROM chat_message WHERE session_id = :sid"),
                {"sid": str(chat_id)}
            )
            # 2. Permanently delete the chat session
            if is_admin:
                conn.execute(
                    text("DELETE FROM chat_session WHERE id = :id"),
                    {"id": str(chat_id)}
                )
            else:
                conn.execute(
                    text("DELETE FROM chat_session WHERE id = :id AND (user_id = :uid OR user_id = :uid_str)"),
                    {"id": str(chat_id), "uid": user_id, "uid_str": str(user_id)}
                )
            conn.commit()
        except Exception as e:
            print(f"Error permanently deleting chat: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to delete chat: {str(e)}")

    return {"status": "success", "message": "Chat permanently deleted"}
