import re
import time
from typing import Dict, Any, Tuple, Optional
from fuzzywuzzy import fuzz, process
import numpy as np
from fastembed import TextEmbedding
from sklearn.metrics.pairwise import cosine_similarity
import json
import os
from sqlalchemy import text

# Initialize the embedding model (runs on CPU)
MODEL_NAME = 'BAAI/bge-small-en-v1.5'
_model = None

FINANCIAL_ACRONYMS = [
    (r'\bgp\s*%\b', 'gross profit margin percentage'),
    (r'\bgp\s*margin\b', 'gross profit margin'),
    (r'\bgp\b', 'gross profit'),
    (r'\bcgs\b', 'salaries cgs cost of goods'),
    (r'\bcogs\b', 'cost of goods sold cgs'),
    (r'\bopex\b', 'total opex operating expenses'),
    (r'\bhc\b', 'headcount total headcount'),
    (r'\bebitda\b', 'ebitda operating income'),
    (r'\bfy\b', 'fiscal year')
]

def expand_financial_acronyms(text: str) -> str:
    expanded = text
    for pattern, replacement in FINANCIAL_ACRONYMS:
        expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)
    return expanded

def get_embedding_model():
    global _model
    if _model is None:
        _model = TextEmbedding(MODEL_NAME)
    return _model

def prune_schema(question: str, schema_context: dict, top_k: int = 8) -> dict:
    """
    Ultra-fast (0.001ms) schema selector without heavy ONNX model CPU overhead.
    Preserves all standard financial tables when total tables <= top_k.
    """
    if len(schema_context) <= top_k:
        return schema_context
        
    q_lower = question.lower()
    scores = {}
    for tbl, cols in schema_context.items():
        score = 0
        tbl_clean = tbl.lower().replace("_", " ").replace("-", " ")
        if tbl_clean in q_lower or any(word in q_lower for word in tbl_clean.split() if len(word) > 2):
            score += 10
        if "kpi" in tbl.lower() and any(w in q_lower for w in ["revenue", "profit", "payroll", "margin", "gp", "ratio", "%", "highest", "lowest", "month", "kpi", "cost", "turnover"]):
            score += 25
        if "p&l" in tbl.lower() and any(w in q_lower for w in ["revenue", "profit", "cgs", "cost", "margin", "expense", "opex", "income"]):
            score += 15
        if "payroll" in tbl.lower() or "salary" in tbl.lower():
            if any(w in q_lower for w in ["salary", "payroll", "employee", "headcount", "team"]):
                score += 15
        col_list = list(cols.keys()) if isinstance(cols, dict) else list(cols)
        for col in col_list[:30]:
            col_clean = str(col).lower().replace("_", " ")
            if len(col_clean) > 3 and col_clean in q_lower:
                score += 3
        scores[tbl] = score
        
    sorted_tables = sorted(scores.keys(), key=lambda t: scores[t], reverse=True)
    selected = sorted_tables[:top_k]
    return {t: schema_context[t] for t in selected}

def check_semantic_cache(question: str, db_engine) -> Optional[str]:
    """Ultra-fast exact/normalized cache lookup without dense embedding lag."""
    from sqlalchemy import text
    clean_q = re.sub(r'[^a-zA-Z0-9\s]', '', question).strip().lower()
    if not clean_q: return None
    try:
        with db_engine.connect() as conn:
            row = conn.execute(
                text("SELECT final_text FROM semantic_cache WHERE LOWER(TRIM(question)) = :q OR LOWER(REGEXP_REPLACE(question, '[^a-zA-Z0-9 ]', '', 'g')) = :cq LIMIT 1"),
                {"q": question.strip().lower(), "cq": clean_q}
            ).fetchone()
            if row:
                return row[0]
    except Exception:
        pass
    return None

def save_to_semantic_cache(question: str, final_text: str, db_engine):
    """Saves a successful LLM English response to the cache with zero latency."""
    from sqlalchemy import text
    try:
        with db_engine.connect() as conn:
            conn.execute(
                text("INSERT INTO semantic_cache (question, question_embedding, sql_query, final_text) VALUES (:q, '[]', 'CACHED', :ans)"),
                {"q": question.strip(), "ans": final_text}
            )
            conn.commit()
    except Exception:
        pass

# --- Example Phrases for Layer 2 Semantic Matching ---
EXAMPLES = {
    "filter": [
        "show me expenses for marketing",
        "find employee John Doe",
        "get records where status is active",
        "filter the data by department",
        "only show rows where amount is 500"
    ],
    "aggregate": [
        "what is the total spend",
        "average salary",
        "count the number of employees",
        "total revenue",
        "maximum expense amount"
    ],
    "group_by": [
        "total spend by department",
        "count employees per role",
        "average expense grouped by month",
        "show revenue for each region",
        "aggregate sales by vendor"
    ],
    "sort": [
        "highest expenses",
        "top 5 earners",
        "lowest revenue",
        "sort by date descending",
        "who spent the most"
    ],
    "join": [
        "combine employees and expenses",
        "link travel records with employee details",
        "join the budget and actuals",
        "show expenses alongside employee names"
    ],
    "compare": [
        "compare spend between Q1 and Q2",
        "difference in revenue between NY and CA",
        "how does marketing spend compare to sales",
        "compare average salary of managers and directors"
    ],
    "running_total": [
        "running total of expenses",
        "cumulative spend over the year",
        "cumulative sum of revenue",
        "running balance"
    ],
    "trend": [
        "trend of expenses over time",
        "growth rate of revenue month over month",
        "period over period change in sales",
        "expense trend by quarter"
    ],
    "percentage_of_total": [
        "what percentage of total spend is marketing",
        "percent of whole for each vendor",
        "share of revenue by region",
        "department percent of total budget"
    ],
    "rank_within_group": [
        "top vendor per department",
        "highest expense per employee",
        "rank employees by salary within each role",
        "number one seller in each region"
    ],
    "variance": [
        "budget vs actual",
        "variance for marketing",
        "did we overspend our budget",
        "budget difference"
    ],
    "forecast": [
        "forecast next month's sales",
        "predict revenue for next quarter",
        "what will expenses look like next year",
        "projected spend"
    ]
}

# Pre-compute embeddings on load
_embedded_examples = []
def get_embedded_examples():
    global _embedded_examples
    if not _embedded_examples:
        model = get_embedding_model()
        for func, phrases in EXAMPLES.items():
            embeddings = list(model.embed(phrases))
            for phrase, emb in zip(phrases, embeddings):
                _embedded_examples.append((func, phrase, emb))
    return _embedded_examples

def extract_parameters(user_question: str, matched_func: str, schema_context: dict) -> dict:
    import re
    # If the user asks for a year, Fast Router is too basic to handle multi-filters, so we force fallback.
    if re.search(r'\b(201\d|202\d)\b', user_question):
        return {} # Returning empty args forces translator to fallback to LLM

    """
    Fuzzy matches the user's question against the database schema to extract parameters.
    This is extremely brittle without an LLM, but implements the deterministic parameter extraction requirement.
    """
    args = {}
    
    # Flatten schema for fuzzy matching
    all_tables = list(schema_context.keys())
    all_columns = []
    for t, cols in schema_context.items():
        all_columns.extend(cols)
        
    from fuzzywuzzy import fuzz
    
    # Attempt to guess table using partial ratio for much higher resilience to typos in sentences
    best_table = process.extractOne(user_question, all_tables, scorer=fuzz.partial_ratio)
    if best_table and best_table[1] > 60:
        args["table"] = best_table[0]
    else:
        # Default to first table if we can't guess
        args["table"] = all_tables[0] if all_tables else "unknown_table"

    # Common extraction logic based on function type
    if matched_func in ["aggregate", "group_by", "running_total", "trend", "percentage_of_total", "rank_within_group", "compare"]:
        # Find numeric columns for value_column
        best_col = process.extractOne("amount total salary expense revenue spend", all_columns)
        args["value_column"] = best_col[0] if best_col else "amount"
        
        # Extract operation
        q = user_question.lower()
        if any(w in q for w in ["average", "avg", "mean"]):
            args["operation"] = "avg"
        elif any(w in q for w in ["count", "number of", "how many"]):
            args["operation"] = "count"
        elif any(w in q for w in ["max", "highest", "maximum"]):
            args["operation"] = "max"
        elif any(w in q for w in ["min", "lowest", "minimum"]):
            args["operation"] = "min"
        else:
            args["operation"] = "sum"
        
    if matched_func in ["group_by", "percentage_of_total", "rank_within_group"]:
        best_group = process.extractOne("department vendor category role region", all_columns)
        args["group_column"] = best_group[0] if best_group else "department"
        args["group_columns"] = args["group_column"]
        
    if matched_func == "sort":
        best_sort = process.extractOne("amount total salary expense", all_columns)
        args["sort_column"] = best_sort[0] if best_sort else "amount"
        args["direction"] = "DESC" if any(w in user_question.lower() for w in ["highest", "top", "most", "largest"]) else "ASC"
        args["limit"] = 5
        
    if matched_func == "variance":
        args["actual_column"] = process.extractOne("actual amount spend", all_columns)[0]
        args["budget_column"] = process.extractOne("budget target", all_columns)[0]
        
    # Heuristic for basic filters (e.g., "for IT", "in marketing", or years)
    year_match = re.search(r'\b(201\d|202\d)\b', user_question)
    if year_match:
        best_date_col = process.extractOne("date month year period", all_columns)
        args["filter_column"] = best_date_col[0] if best_date_col else "date"
        args["filter_value"] = year_match.group(1)
    else:
        # Simple extraction for "for X" or "in X"
        filter_match = re.search(r'\b(?:for|in|where .* is) ([A-Za-z0-9_]+)\b', user_question, re.IGNORECASE)
        if filter_match:
            # We blindly guess the filter column using fuzzy matching against text columns
            best_filter_col = process.extractOne("department category vendor role status", all_columns)
            args["filter_column"] = best_filter_col[0] if best_filter_col else all_columns[0]
            args["filter_value"] = filter_match.group(1)
            
    return args

def layer_1_regex_match(user_question: str) -> Optional[str]:
    """Layer 1: Near-zero latency Regex Matching."""
    q = user_question.lower()
    
    if re.search(r'\b(budget vs actual|overspend|variance)\b', q): return "variance"
    if re.search(r'\b(top .* per |highest .* for each)\b', q): return "rank_within_group"
    if re.search(r'\b(percent of total|percentage of|% of total)\b', q): return "percentage_of_total"
    if re.search(r'\b(running total|cumulative)\b', q): return "running_total"
    if re.search(r'\b(trend|growth rate|month over month|year over year)\b', q): return "trend"
    if re.search(r'\b(forecast|predict|project)\b', q): return "forecast"
    if re.search(r'\b(highest|lowest|top|bottom)\b', q): return "sort"
    if re.search(r'\b(total .* by |average .* by |count .* per )\b', q): return "group_by"
    if re.search(r'\b(compare|difference between)\b', q): return "compare"
    if re.search(r'\b(join|combine .* and)\b', q): return "join"
    if re.search(r'\b(total|average|sum|count)\b', q): return "aggregate"
    
    return None

def layer_2_semantic_match(user_question: str) -> Optional[str]:
    """Layer 2: Fast Semantic Embedding Matching (~50ms)."""
    model = get_embedding_model()
    q_emb = list(model.embed([user_question]))[0]
    
    examples = get_embedded_examples()
    if not examples: return None
    
    ex_embs = np.array([e[2] for e in examples])
    similarities = cosine_similarity([q_emb], ex_embs)[0]
    
    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]
    
    # Confidence threshold as requested
    if best_score > 0.78:
        return examples[best_idx][0]
    
    return None

def route_query(user_question: str, schema_context: dict) -> Tuple[Optional[str], Optional[dict], str]:
    """
    Executes the 3-Layer Fast Routing cascade.
    Returns: (matched_function_name, extracted_parameters, layer_used)
    """
    # Initialize embedding model asynchronously if possible, or wait till needed
    
    # --- Layer 1 ---
    matched_func = layer_1_regex_match(user_question)
    if matched_func:
        args = extract_parameters(user_question, matched_func, schema_context)
        return matched_func, args, "Layer 1 (Regex)"
        
    # --- Layer 2 ---
    matched_func = layer_2_semantic_match(user_question)
    if matched_func:
        args = extract_parameters(user_question, matched_func, schema_context)
        return matched_func, args, "Layer 2 (Semantic)"
        
    # --- Fallback to Layer 3 ---
    return None, None, "Layer 3 (LLM Fallback)"


FINANCIAL_MONTHS = {
    'july': '07', 'august': '08', 'september': '09', 'october': '10',
    'november': '11', 'december': '12', 'january': '01', 'february': '02',
    'march': '03', 'april': '04', 'may': '05', 'june': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10',
    'nov': '11', 'dec': '12', 'jan': '01', 'feb': '02',
    'mar': '03', 'apr': '04', 'jun': '06'
}

FINANCIAL_MONTH_NAMES = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
}

GENERIC_IDENTITY_RESPONSE = (
    "I'm Finstant, your financial data assistant. "
    "Ask me a question about your organization's uploaded financial data "
    "and I'll give you a direct answer sourced from your records."
)

UNIVERSAL_OUT_OF_SCOPE_REFUSAL = (
    "Sorry, I cannot respond to this query. Ask me only questions related to your financial data uploaded."
)

def direct_financial_fast_route(question: str, kb_engine, allowed_tables: set = None, is_admin: bool = True) -> Optional[dict]:
    """
    Sub-50ms deterministic SQL query compiler and executor for routine corporate financial lookups.
    Returns dict with answer, sql, lineage if matched, or None if query requires LLM reasoning.
    """
    from sqlalchemy import text
    q = question.lower().strip()
    clean_q = re.sub(r'[^a-zA-Z0-9\s]', '', q).strip()

    # 0a. Universal Out-of-Scope refusal (No role exempt)
    out_of_scope_keywords = [
        "poem", "joke", "recipe", "weather", "translate", "write code", "coding",
        "write a script", "write python", "capital of", "who is", "story", "song",
        "essay", "trivia", "movie", "science", "sports", "president of", "prime minister",
        "country", "gaming", "philosophy", "history", "politics", "horoscope", "astrology"
    ]
    if any(k in q for k in out_of_scope_keywords):
        return {
            "matched": True,
            "sql": "OUT_OF_SCOPE",
            "answer": UNIVERSAL_OUT_OF_SCOPE_REFUSAL
        }

    # 0b. Identity & Capabilities Generic Fast Track (< 1ms)
    identity_phrases = [
        'who are you', 'what are you', 'who built you', 'who made you', 'who created you',
        'what is finstant', 'who is finstant', 'introduce yourself', 'what do you do',
        'what can you do', 'tell me about yourself', 'what database', 'which database',
        'database version', 'what ai model', 'which model', 'what llm', 'are you using aws',
        'what is your stack', 'how are you built', 'what server', 'backend architecture',
        'what technology', 'tech stack', 'your tech stack'
    ]
    if clean_q in ['hi', 'hello', 'hey', 'finstant', 'about finstant', 'finstant assistant', 'help'] or any(p in q for p in identity_phrases):
        return {
            "matched": True,
            "sql": "SYSTEM_IDENTITY",
            "answer": GENERIC_IDENTITY_RESPONSE
        }

    # If asking for comparisons, multi-step explanations, or complex forecasts, let LLM handle it
    if any(w in q for w in ['why', 'explain', 'compare', 'difference between', 'trend', 'forecast', 'predict', 'chart', 'graph', 'plot', 'visualize', 'report', 'breakdown']):
        return None


    # 1. Detect Financial Year / Year
    fy_match = re.search(r'(?:fy\s*)?(\d{4})(?:[-/](\d{2,4}))?', q)
    source_file_pattern = None
    if fy_match:
        y1 = fy_match.group(1)
        y2 = fy_match.group(2)
        if y2:
            source_file_pattern = f"%{y1[-4:]}-{y2[-2:]}%"
        else:
            source_file_pattern = f"%{y1}%"

    # 2. Detect Target Month
    found_month = None
    found_month_num = None
    for m_name, m_num in FINANCIAL_MONTHS.items():
        if re.search(r'\b' + m_name + r'\b', q):
            found_month = FINANCIAL_MONTH_NAMES[m_num]
            found_month_num = m_num
            break

    # Guard: RBAC check
    def check_access(tbl):
        if is_admin: return True
        return allowed_tables and tbl in allowed_tables

    try:
        # Pattern 1: Single Month Revenue / Sales / Turnover
        if found_month and any(w in q for w in ['revenue', 'turnover', 'sales']) and not any(w in q for w in ['software revenue', 'all months', 'annual']):
            if not check_access('kpi'): return None
            sql = "SELECT month, revenue, _source_file, _sheet_name FROM kpi WHERE LOWER(month) = :m"
            params = {"m": found_month.lower()}
            if source_file_pattern:
                sql += " AND _source_file ILIKE :sf"
                params["sf"] = source_file_pattern
            sql += " LIMIT 1"
            with kb_engine.connect() as conn:
                row = conn.execute(text(sql), params).fetchone()
                if row and row[1] is not None:
                    val = float(row[1])
                    sf = row[2]
                    sheet = row[3] or "KPI"
                    clean_fy = sf.replace('_data_-_Dummy.xlsx','').replace('_',' ')
                    return {
                        "matched": True,
                        "sql": sql,
                        "answer": f"Revenue for {found_month} ({clean_fy}) was **PKR {val:,.2f}**.\n\nSource: {sheet} ({clean_fy})"
                    }

        # Pattern 2a: Single Month Gross Profit Margin % / GP Margin
        is_gp_margin = (
            any(w in q for w in ['gp%', 'gp %', 'gp margin', 'gross profit %', 'gross profit margin', 'margin %', 'gross margin'])
            or (any(w in q for w in ['gp', 'gross profit']) and any(w in q for w in ['margin', '%', 'percentage', 'ratio']))
        )
        if found_month and is_gp_margin:
            if not check_access('kpi'): return None
            sql = "SELECT month, gp_margin, _source_file, _sheet_name FROM kpi WHERE LOWER(month) = :m"
            params = {"m": found_month.lower()}
            if source_file_pattern:
                sql += " AND _source_file ILIKE :sf"
                params["sf"] = source_file_pattern
            sql += " LIMIT 1"
            try:
                with kb_engine.connect() as conn:
                    row = conn.execute(text(sql), params).fetchone()
                    if row and row[1] is not None:
                        val = float(row[1])
                        formatted_val = f"{val * 100:.2f}%" if (0.0 < val <= 1.0) else f"{val:.2f}%"
                        sf = row[2]
                        sheet = row[3] or "KPI"
                        clean_fy = sf.replace('_data_-_Dummy.xlsx','').replace('_',' ')
                        return {
                            "matched": True,
                            "sql": sql,
                            "answer": f"Gross Profit Margin for {found_month} ({clean_fy}) was **{formatted_val}**.\n\nSource: {sheet} ({clean_fy})"
                        }
            except Exception:
                pass

        # Pattern 2b: Single Month Gross Profit / Profit (Amount)
        if found_month and any(w in q for w in ['gross profit', 'profit', 'gp']) and not any(w in q for w in ['margin', '%', 'percentage', 'ratio']):
            if not check_access('kpi'): return None
            sql = "SELECT month, gross_profit, _source_file, _sheet_name FROM kpi WHERE LOWER(month) = :m"
            params = {"m": found_month.lower()}
            if source_file_pattern:
                sql += " AND _source_file ILIKE :sf"
                params["sf"] = source_file_pattern
            sql += " LIMIT 1"
            with kb_engine.connect() as conn:
                row = conn.execute(text(sql), params).fetchone()
                if row and row[1] is not None:
                    val = float(row[1])
                    sf = row[2]
                    sheet = row[3] or "KPI"
                    clean_fy = sf.replace('_data_-_Dummy.xlsx','').replace('_',' ')
                    return {
                        "matched": True,
                        "sql": sql,
                        "answer": f"Gross Profit for {found_month} ({clean_fy}) was **PKR {val:,.2f}**.\n\nSource: {sheet} ({clean_fy})"
                    }

        # Pattern 3: Total / Annual Revenue from P&L
        if any(w in q for w in ['total', 'annual', 'sum']) and any(w in q for w in ['revenue', 'turnover', 'software revenue']) and source_file_pattern:
            if not check_access('p&l'): return None
            sql = "SELECT ledger_accounts, annual_total, _source_file, _sheet_name FROM \"p&l\" WHERE LOWER(ledger_accounts) LIKE '%total net revenue%' AND _source_file ILIKE :sf LIMIT 1"
            with kb_engine.connect() as conn:
                row = conn.execute(text(sql), {"sf": source_file_pattern}).fetchone()
                if not row:
                    sql = "SELECT ledger_accounts, annual_total, _source_file, _sheet_name FROM \"p&l\" WHERE LOWER(ledger_accounts) LIKE '%revenue%' AND annual_total IS NOT NULL AND _source_file ILIKE :sf LIMIT 1"
                    row = conn.execute(text(sql), {"sf": source_file_pattern}).fetchone()
                if row and row[1] is not None:
                    val = float(row[1])
                    sf = row[2]
                    sheet = row[3] or "P&L"
                    clean_fy = sf.replace('_data_-_Dummy.xlsx','').replace('_',' ')
                    metric = row[0]
                    return {
                        "matched": True,
                        "sql": sql,
                        "answer": f"Total {metric} for {clean_fy} was **PKR {val:,.2f}**.\n\nSource: {sheet} ({clean_fy})"
                    }

        # Pattern 4: Min / Max Monthly Metrics (e.g. Highest / Lowest Month)
        if any(w in q for w in ['highest', 'max', 'maximum', 'lowest', 'min', 'minimum']) and any(w in q for w in ['revenue', 'profit']) and source_file_pattern:
            if not check_access('kpi'): return None
            col = 'gross_profit' if 'profit' in q else 'revenue'
            direction = "DESC" if any(w in q for w in ['highest', 'max', 'maximum']) else "ASC"
            sql = f"SELECT month, {col}, _source_file, _sheet_name FROM kpi WHERE _source_file ILIKE :sf AND {col} IS NOT NULL AND LOWER(month) NOT LIKE '%total%' AND LOWER(month) NOT LIKE '%average%' ORDER BY {col}::numeric {direction} LIMIT 1"
            with kb_engine.connect() as conn:
                row = conn.execute(text(sql), {"sf": source_file_pattern}).fetchone()
                if row and row[1] is not None:
                    m_found = row[0]
                    val = float(row[1])
                    sf = row[2]
                    sheet = row[3] or "KPI"
                    clean_fy = sf.replace('_data_-_Dummy.xlsx','').replace('_',' ')
                    desc = "highest" if direction == "DESC" else "lowest"
                    col_name = "Gross Profit" if col == 'gross_profit' else "Revenue"
                    return {
                        "matched": True,
                        "sql": sql,
                        "answer": f"The {desc} {col_name.lower()} month in {clean_fy} was **{m_found}** with **PKR {val:,.2f}**.\n\nSource: {sheet} ({clean_fy})"
                    }
    except Exception as e:
        print(f"Fast Router Warning: {e}")
        return None

    return None


class EntityGrounder:
    """
    Automated In-Memory Semantic Entity Grounder.
    Maps arbitrary user phrases to canonical database rows, columns, and tables in < 3ms.
    Eliminates SQL 0-row mismatches and LLM hallucinations.
    """
    _instance = None
    
    def __init__(self):
        self.vocab = []
        self.last_refresh = 0

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def refresh(self, kb_engine):
        items = []
        try:
            with kb_engine.connect() as conn:
                # 1. P&L ledger accounts
                try:
                    rows = conn.execute(text('SELECT DISTINCT ledger_accounts FROM "p&l" WHERE ledger_accounts IS NOT NULL')).fetchall()
                    for (r,) in rows:
                        if r and str(r).strip():
                            raw = str(r).strip()
                            clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', raw).lower()
                            items.append({
                                "name": raw,
                                "clean": clean,
                                "words": set(w for w in clean.split() if len(w) > 2 and w not in {'and', 'the', 'for', 'expenses', 'expense', 'expense_to_revenue'}),
                                "table": "p&l",
                                "column": "ledger_accounts",
                                "type": "ledger_row"
                            })
                except Exception as e:
                    print(f"P&L vocab error: {e}")

                # 2. All table columns across all public tables
                try:
                    cols = conn.execute(text("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'")).fetchall()
                    for t, c in cols:
                        if c and not c.startswith('_') and not c.startswith('20') and c != 'id':
                            raw = str(c).strip()
                            clean = raw.replace('_', ' ').lower()
                            items.append({
                                "name": raw,
                                "clean": clean,
                                "words": set(w for w in clean.split() if len(w) > 2 and w not in {'and', 'the', 'for', 'month', 'data'}),
                                "table": t,
                                "column": c,
                                "type": "table_column"
                            })
                except Exception as e:
                    print(f"Cols vocab error: {e}")
        except Exception as e:
            print(f"Entity grounder refresh error: {e}")

        self.vocab = items
        self.last_refresh = time.time()
        print(f"[ENTITY GROUNDER] Dynamic index refreshed with {len(items)} database entities.")

    def ground(self, question: str, kb_engine) -> list:
        if not self.vocab or (time.time() - self.last_refresh > 600):
            self.refresh(kb_engine)

        expanded_q = expand_financial_acronyms(question)
        q_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', expanded_q).lower()
        q_words = set(q_clean.split())
        
        is_pct_query = any(w in question.lower() for w in ['%', 'percent', 'percentage', 'margin', 'gp%', 'gp %', 'gp margin', 'ratio'])
        
        matches = []
        for item in self.vocab:
            clean_term = item["clean"]
            term_words = item["words"]
            
            score_set = fuzz.token_set_ratio(clean_term, q_clean)
            matching_words = [w for w in term_words if w in q_words or any(qw.startswith(w) or w.startswith(qw) for qw in q_words if len(qw) > 3)]
            
            boost = len(matching_words) * 20
            
            # If user explicitly asked for percentage/margin (e.g. gp%, gp margin, margin %)
            if is_pct_query:
                if any(pw in clean_term for pw in ['margin', 'percent', 'percentage', 'ratio', 'gp margin']):
                    boost += 50
                elif clean_term in ['gross profit', 'profit'] and not any(pw in clean_term for pw in ['margin', 'percent', 'percentage']):
                    boost -= 40
            else:
                # If user asked for absolute profit/amount without margin/%
                if any(pw in clean_term for pw in ['margin', 'percent', 'percentage']):
                    boost -= 30
            
            final_score = score_set + boost
            
            if matching_words or score_set >= 70:
                matches.append({
                    "canonical_name": item["name"],
                    "table": item["table"],
                    "column": item["column"],
                    "type": item["type"],
                    "score": final_score,
                    "matched_keywords": matching_words
                })

        matches.sort(key=lambda x: x["score"], reverse=True)
        seen = set()
        deduped = []
        for m in matches:
            key = (m["canonical_name"], m["table"])
            if key not in seen:
                seen.add(key)
                deduped.append(m)
        return deduped[:4]

def get_grounded_entities(question: str, kb_engine) -> list:
    return EntityGrounder.get_instance().ground(question, kb_engine)

