import re
import os

FINANCIAL_METRICS_MAP = [
    (r'\b(gp\s*%|gross\s+profit\s+(margin|percentage))\b', 'Gross Profit Margin'),
    (r'\b(gp|gross\s+profit)\b', 'Gross Profit'),
    (r'\b(ebitda|operating\s+income)\b', 'EBITDA'),
    (r'\b(cgs|cogs|cost\s+of\s+goods(\s+sold)?|salaries\s+cgs)\b', 'Cost of Goods Sold'),
    (r'\b(software\s+rev(enue)?)\b', 'Software Revenue'),
    (r'\b(recurring\s+rev(enue)?|arr|mrr)\b', 'Recurring Revenue'),
    (r'\b(subscription(\s+rev(enue)?)?)\b', 'Subscription Revenue'),
    (r'\b(net\s+rev(enue)?|total\s+rev(enue)?|rev(enue)?)\b', 'Revenue'),
    (r'\b(travel\s*(&|and)?\s*leap)\b', 'Travel & Leap'),
    (r'\b(travel(\s+expenses?)?)\b', 'Travel Expenses'),
    (r'\b(leap(\s+expenses?)?)\b', 'Leap Expenses'),
    (r'\b(payroll|salaries|salary|compensation)\b', 'Payroll & Compensation'),
    (r'\b(headcount|fte|employees?|team\s+size)\b', 'Headcount Analysis'),
    (r'\b(opex|operating\s+expenses?)\b', 'Operating Expenses'),
    (r'\b(marketing|advertising)\b', 'Marketing Spend'),
    (r'\b(net\s+profit|net\s+income|earnings)\b', 'Net Profit'),
    (r'\b(cash\s*flow)\b', 'Cash Flow'),
    (r'\b(balance\s*sheet)\b', 'Balance Sheet'),
    (r'\b(financial\s+statements?)\b', 'Financial Statements'),
    (r'\b(p&l|profit\s+and\s+loss)\b', 'P&L Statement'),
    (r'\b(budget(\s+vs\s+actual)?|variance)\b', 'Budget Variance'),
]

def format_period(m):
    val = m.group(1).upper()
    # If like Q32024 or Q3 2024, ensure space between quarter and year
    q_match = re.match(r'(Q[1-4])\s*(\d{2,4})', val)
    if q_match:
        return f"{q_match.group(1)} {q_match.group(2)}"
    fy_match = re.match(r'(FY)\s*(\d{2,4})', val)
    if fy_match:
        return f"{fy_match.group(1)} {fy_match.group(2)}"
    return val

PERIOD_PATTERNS = [
    (r'\b(q[1-4]\s*(?:20\d\d|\d\d)?)\b', format_period),
    (r'\b(fy\s*(?:20\d\d|\d\d)?)\b', format_period),
    (r'\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:20\d\d)?)\b', lambda m: m.group(1).title()),
    (r'\b(202[0-9]\s*(?:vs\.?|and|-)\s*202[0-9])\b', lambda m: m.group(1).title()),
    (r'\b(202[0-9])\b', lambda m: m.group(1)),
    (r'\b(ytd|year\s+to\s+date)\b', lambda m: 'YTD'),
    (r'\b(last\s+quarter|previous\s+quarter)\b', lambda m: 'Last Quarter'),
    (r'\b(last\s+month|previous\s+month)\b', lambda m: 'Last Month'),
    (r'\b(last\s+year|previous\s+year)\b', lambda m: 'Last Year'),
]

INTENT_MAP = [
    (r'\b(compare|comparison|versus|vs\.?|difference|diff)\b', 'Comparison'),
    (r'\b(breakdown|distribution|split|detail|details)\b', 'Breakdown'),
    (r'\b(trend|growth|historical|over\s+time|trajectory)\b', 'Trend'),
    (r'\b(forecast|projection|projections|predict)\b', 'Forecast'),
    (r'\b(highest|top|maximum|max|largest)\b', 'Top Metrics'),
    (r'\b(lowest|bottom|minimum|min|least)\b', 'Lowest Metrics'),
    (r'\b(summary|overview|status|report)\b', 'Overview'),
]


def generate_semantic_chat_title(query: str, answer: str = '') -> str:
    '''Deterministically generates a concise 2-4 word executive title for a chat session.'''
    q = (query or '').strip()
    if not q:
        return 'Financial Discussion'

    q_lower = q.lower()

    if any(p in q_lower for p in ['who are you', 'what can you do', 'your role', 'what are your capabilities', 'introduce yourself']):
        return 'Assistant Overview & Scope'
    if any(p in q_lower for p in ['what tables', 'available tables', 'what data', 'list datasets', 'show sheets']):
        return 'Knowledge Base Datasets'
    if any(q_lower.startswith(g) for g in ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings']) and len(q.split()) <= 3:
        return 'Financial Consultation'

    matched_period = None
    for pattern, formatter in PERIOD_PATTERNS:
        m = re.search(pattern, q_lower)
        if m:
            matched_period = formatter(m)
            break

    matched_metric = None
    for pattern, metric_name in FINANCIAL_METRICS_MAP:
        if re.search(pattern, q_lower):
            matched_metric = metric_name
            break

    matched_intent = None
    for pattern, intent_name in INTENT_MAP:
        if re.search(pattern, q_lower):
            matched_intent = intent_name
            break

    if answer and (not matched_metric or not matched_period):
        ans_lower = answer[:400].lower()
        if not matched_metric:
            for pattern, metric_name in FINANCIAL_METRICS_MAP:
                if re.search(pattern, ans_lower):
                    matched_metric = metric_name
                    break
        if not matched_period:
            for pattern, formatter in PERIOD_PATTERNS:
                m = re.search(pattern, ans_lower)
                if m:
                    matched_period = formatter(m)
                    break

    parts = []
    if matched_period:
        parts.append(matched_period)
    if matched_metric:
        parts.append(matched_metric)
    if matched_intent and matched_intent not in ['Overview']:
        if matched_intent in ['Top Metrics', 'Lowest Metrics']:
            parts.append('Analysis' if matched_metric else matched_intent)
        else:
            parts.append(matched_intent)

    if parts:
        if len(parts) == 1:
            if parts[0] in [m[1] for m in FINANCIAL_METRICS_MAP]:
                parts.append('Overview')
            elif parts[0] in [m[1] for m in INTENT_MAP]:
                parts.insert(0, 'Financial')
            else:
                parts.append('Financial Analysis')
        return ' '.join(parts[:4])

    cleaned = re.sub(
        r'^(hello|hi|hey|good\s+(morning|afternoon|evening))[,\s\!]*',
        '',
        q,
        flags=re.IGNORECASE
    ).strip()
    cleaned = re.sub(r'^[^\w]+', '', cleaned).strip()

    cleaned = re.sub(
        r'^(can\s+you\s+(please\s+)?(tell\s+me|show\s+me|provide|give\s+me|find|calculate|check|explain|describe)|'
        r'could\s+you\s+(please\s+)?|'
        r'please\s+(tell\s+me|show\s+me|provide|give\s+me|find|calculate)|'
        r'need\s+(some\s+)?help\s+(with|analyzing)?|'
        r'what\s+(is|are|was|were)\s+(the\s+)?|'
        r'how\s+much\s+(did\s+we\s+spend\s+on|is\s+the|was\s+the)|'
        r'how\s+many|'
        r'i\s+want\s+to\s+(see|know|find|check)|'
        r'tell\s+me\s+about|'
        r'show\s+me\s+(the\s+)?|'
        r'do\s+we\s+have)\s*',
        '',
        cleaned,
        flags=re.IGNORECASE
    ).strip()

    cleaned = re.sub(r'[\?\.\!\:\;]+$', '', cleaned).strip()
    cleaned = re.sub(r'^(about|the|our|all|any|for|in|of|why)\s+', '', cleaned, flags=re.IGNORECASE).strip()

    words = [w for w in cleaned.split() if w]
    if words:
        title_cand = ' '.join(words[:4]).title()
        if len(title_cand) > 35:
            title_cand = ' '.join(words[:3]).title()
        if title_cand:
            return title_cand

    return 'Financial Query'


def generate_chat_title(query: str, answer: str = '') -> str:
    '''Hybrid Title Generator:
    1. Attempts to generate a 2-4 word executive title using LLM.
    2. If LLM is unavailable or fails, falls back gracefully to generate_semantic_chat_title.
    '''
    q = (query or '').strip()
    if not q:
        return 'Financial Discussion'

    try:
        from query_engine.translator import call_llm
        
        system_instruction = (
            "You are an executive assistant creating concise chat titles for a financial analysis platform.\n"
            "Given the user's initial question and the assistant's answer snippet, output a 2 to 4-word title summarizing the topic.\n"
            "Rules:\n"
            "- Exactly 2 to 4 words.\n"
            "- Do NOT repeat the user's sentence.\n"
            "- Do NOT include quotation marks, punctuation, or conversational greetings.\n"
            "- Capitalize Each Word In Title Case (e.g., 'Q3 2024 Software Revenue', 'Payroll & Headcount Breakdown').\n"
            "- Output ONLY the title text and nothing else."
        )
        
        snippet = (answer or '')[:250].strip()
        user_content = f"User Query: {q}"
        if snippet:
            user_content += f"\nAssistant Context: {snippet}"

        response = call_llm(
            system_instruction=system_instruction,
            messages=[{"role": "user", "content": user_content}],
            tools=None
        )

        raw_title = response.get("content", "").strip() if isinstance(response, dict) else ""
        raw_title = raw_title.replace('"', '').replace("'", "").strip().strip(".").strip()
        words = raw_title.split()
        if 2 <= len(words) <= 5 and len(raw_title) <= 45:
            if not any(err in raw_title.lower() for err in ["sorry", "i cannot", "error", "assistant", "system", "here is"]):
                return raw_title.title()
    except Exception:
        pass

    return generate_semantic_chat_title(query, answer)
