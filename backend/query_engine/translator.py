import os
import requests
import uuid
from .functions import WHITELISTED_FUNCTIONS, validate_function_call
from .executor import execute_function
import json
import pathlib
from dotenv import load_dotenv

load_dotenv(dotenv_path=pathlib.Path(__file__).parent.parent / ".env")
load_dotenv()

def json_to_csv(data):
    if not data:
        return ""
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list) or not isinstance(data[0], dict):
        return str(data)
    
    keys = list(data[0].keys())
    csv_str = ",".join(keys) + "\n"
    for row in data:
        csv_str += ",".join(str(row.get(k, "")) for k in keys) + "\n"
    return csv_str

import boto3

BEDROCK_REGION = os.getenv("BEDROCK_REGION", os.getenv("AWS_REGION", "us-east-1"))
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-5-haiku-20241022-v1:0")

def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

def call_anthropic_direct(system_instruction: str, messages: list, tools=None, force_tool=False):
    """Direct API call using Anthropic Messages API when ANTHROPIC_API_KEY is provided."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001").strip()

    anthropic_tools = []
    if tools:
        for t in tools:
            func = t["function"]
            anthropic_tools.append({
                "name": func["name"],
                "description": func["description"],
                "input_schema": func["parameters"]
            })

    anthropic_messages = []
    last_tool_ids = []

    for m in messages:
        role = m.get("role")
        if role == "system":
            continue
        content = m.get("content", "")
        blocks = []

        if role == "assistant":
            if isinstance(content, str) and content:
                blocks.append({"type": "text", "text": content})
            if "tool_calls" in m and m["tool_calls"]:
                last_tool_ids = []
                for tc in m["tool_calls"]:
                    tid = tc.get("id") or f"toolu_{uuid.uuid4().hex[:12]}"
                    last_tool_ids.append(tid)
                    blocks.append({
                        "type": "tool_use",
                        "id": tid,
                        "name": tc["function"]["name"],
                        "input": tc["function"]["arguments"]
                    })
            if blocks:
                anthropic_messages.append({"role": "assistant", "content": blocks})

        elif role == "user":
            if last_tool_ids:
                for tid in last_tool_ids:
                    blocks.append({
                        "type": "tool_result",
                        "tool_use_id": tid,
                        "content": str(content)
                    })
                last_tool_ids = []
            else:
                if isinstance(content, str) and content:
                    blocks.append({"type": "text", "text": content})
            if blocks:
                anthropic_messages.append({"role": "user", "content": blocks})

    payload = {
        "model": model,
        "system": system_instruction,
        "messages": anthropic_messages,
        "max_tokens": 4096,
        "temperature": 0.0
    }
    if anthropic_tools:
        payload["tools"] = anthropic_tools
        if force_tool:
            payload["tool_choice"] = {"type": "any"}
        else:
            payload["tool_choice"] = {"type": "auto"}

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    candidate_models = [
        model,
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-sonnet-5",
        "claude-opus-4-5-20251101",
        "claude-opus-4-6",
        "claude-opus-5"
    ]
    seen = set()
    model_list = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    first_err = None
    last_err = None
    for m_id in model_list:
        payload["model"] = m_id
        res = requests.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers, timeout=60)
        if res.status_code == 200:
            data = res.json()
            content_text = ""
            tool_calls = []
            for block in data.get("content", []):
                if block.get("type") == "text":
                    content_text += block.get("text", "")
                elif block.get("type") == "tool_use":
                    tool_calls.append({
                        "id": block["id"],
                        "function": {
                            "name": block["name"],
                            "arguments": block["input"]
                        }
                    })
            return {
                "role": "assistant",
                "content": content_text,
                "tool_calls": tool_calls
            }
        else:
            err_msg = f"Anthropic API ({res.status_code}) for model '{m_id}': {res.text}"
            print(f"[ANTHROPIC NOTICE] {err_msg}")
            if not first_err:
                first_err = Exception(err_msg)
            last_err = Exception(err_msg)
            continue

    raise first_err or last_err

def call_bedrock(system_instruction: str, messages: list, tools=None, force_tool=False):
    """Direct API call using AWS Bedrock Converse API with IAM role credentials."""
    client = get_bedrock_client()

    tool_config = None
    if tools:
        bedrock_tools = []
        for t in tools:
            func = t["function"]
            bedrock_tools.append({
                "toolSpec": {
                    "name": func["name"],
                    "description": func["description"],
                    "inputSchema": {
                        "json": func["parameters"]
                    }
                }
            })
        tool_config = {"tools": bedrock_tools}
        if force_tool:
            tool_config["toolChoice"] = {"any": {}}
        else:
            tool_config["toolChoice"] = {"auto": {}}

    bedrock_messages = []
    for m in messages:
        role = m["role"]
        if role == "system":
            continue
        
        content = m["content"]
        bedrock_content = []
        
        if isinstance(content, str) and content:
            bedrock_content.append({"text": content})
            
        if "tool_calls" in m and m["tool_calls"]:
            for tc in m["tool_calls"]:
                bedrock_content.append({
                    "toolUse": {
                        "toolUseId": tc["id"],
                        "name": tc["function"]["name"],
                        "input": tc["function"]["arguments"]
                    }
                })
                
        if bedrock_content:
            b_role = "assistant" if role == "assistant" else "user"
            bedrock_messages.append({
                "role": b_role,
                "content": bedrock_content
            })

    system_prompts = [{"text": system_instruction}]

    candidate_models = [
        BEDROCK_MODEL_ID,
        "us.anthropic.claude-3-5-haiku-20241022-v1:0",
        "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        "us.anthropic.claude-3-haiku-20240307-v1:0",
        "anthropic.claude-3-haiku-20240307-v1:0"
    ]
    seen = set()
    model_list = [m for m in candidate_models if not (m in seen or seen.add(m))]

    last_err = None
    for model_id in model_list:
        try:
            kwargs = {
                "modelId": model_id,
                "messages": bedrock_messages,
                "system": system_prompts,
                "inferenceConfig": {
                    "temperature": 0.0,
                    "maxTokens": 4096
                }
            }
            if tool_config:
                kwargs["toolConfig"] = tool_config

            response = client.converse(**kwargs)
            output_message = response["output"]["message"]
            
            content_text = ""
            tool_calls = []
            
            for block in output_message.get("content", []):
                if "text" in block:
                    content_text += block["text"]
                if "toolUse" in block:
                    tu = block["toolUse"]
                    tool_calls.append({
                        "id": tu["toolUseId"],
                        "function": {
                            "name": tu["name"],
                            "arguments": tu["input"]
                        }
                    })
                    
            return {
                "role": "assistant",
                "content": content_text,
                "tool_calls": tool_calls
            }
        except Exception as e:
            last_err = e
            print(f"Bedrock model {model_id} notice: {e}. Trying fallback if available...")
            continue

    raise last_err

def call_llm(system_instruction: str, messages: list, tools=None, force_tool=False):
    """Hybrid router: Uses direct Anthropic API if ANTHROPIC_API_KEY is present; otherwise uses AWS Bedrock."""
    if os.getenv("ANTHROPIC_API_KEY", "").strip():
        return call_anthropic_direct(system_instruction, messages, tools, force_tool=force_tool)
    else:
        return call_bedrock(system_instruction, messages, tools, force_tool=force_tool)


def build_tools():
    tools = []
    for func_name, spec in WHITELISTED_FUNCTIONS.items():
        properties = {}
        required = []
        for param_name, param_desc in spec["parameters"].items():
            properties[param_name] = {"type": "string", "description": param_desc}
            if "Optional" not in param_desc:
                required.append(param_name)
        tools.append({
            "type": "function",
            "function": {
                "name": func_name,
                "description": spec["description"],
                "parameters": {
                    "type": "object", 
                    "properties": properties, 
                    "required": required
                }
            }
        })
    return tools

def run_query_loop(user_id: int, user_question: str, schema_context: dict, chat_history: list = None) -> dict:
    tools = build_tools()

    system_prompt = (
        "You are FINSTΛNT, an AI-powered financial intelligence assistant. When asked who you are, what you are, what you can do, who built you, what database or model you use, or to introduce yourself, reply strictly with: "
        "\"I'm Finstant, your financial data assistant. Ask me a question about your organization's uploaded financial data — for example, revenue, expenses, payroll, or headcount — and I'll give you a direct answer sourced from your records.\"\n\n"
        "CRITICAL ZERO-DISCLOSURE SECURITY RULE:\n"
        "- NEVER disclose database names (e.g. finstant_kb, finstant_users), database engine or version (e.g. PostgreSQL, Postgres 16), internal table names (e.g. 'table p&l', 'monthly_payroll'), SQL queries, cloud providers (AWS, Bedrock), AI model names (Claude, Anthropic), Cognito, EC2, servers, API keys, or backend stack details under ANY circumstance.\n"
        "- If asked about your infrastructure, database, or technology stack, reply strictly with the standard assistant introduction above.\n\n"
        "CORE FINANCIAL TERMINOLOGY & ACRONYMS:\n"
        "- 'gp%' / 'gp margin' / 'gross profit %' / 'gross margin' -> Refers to Gross Profit Margin Percentage (e.g. 'Gross Profit Margin %' in P&L or 'gp_margin' in KPI), NOT the absolute currency amount.\n"
        "- 'gp' / 'gross profit' -> Refers to the absolute Gross Profit currency amount (e.g. 'GROSS PROFIT' in P&L or 'gross_profit' in KPI).\n"
        "- 'cgs' / 'cogs' -> Refers to Cost of Goods / Services / 'Salaries CGS (Projects + Technical)'.\n"
        "- 'opex' -> Refers to Total Operating Expenses ('Total OPEX').\n"
        "- 'hc' -> Refers to Headcount / Total Headcount.\n"
        "- 'ebitda' -> Refers to EBITDA / Operating Income.\n"
        "- 'fy' -> Refers to Fiscal Year.\n\n"
        "STRICT CONCISENESS & RESPONSE SHAPE RULES:\n"
        "1. SINGLE-FACT QUESTION: Must be EXACTLY ONE natural sentence in the shape: '{Metric} for {period} was {value} {currency}.' followed by a newline source citation: 'Source: [sheet] sheet, [metric] row, [column] column — [file].'\n"
        "   - Example: 'Software revenue for July 2025 was 4,200,000 PKR.'\n"
        "   - NEVER wrap a single fact in a Markdown table, bullet list, or introductory framing ('Based on the data...').\n"
        "2. COMPARISON & RANKING QUESTIONS: Provide 2–3 sentences maximum answering the comparison directly, followed by the source citation.\n"
        "3. EXPLICIT TABLE / MULTI-ROW REQUESTS:\n"
        "   - ONLY output a Markdown table when the result contains genuinely multiple rows/records, or the user explicitly asked for a 'table', 'breakdown', or 'list all'.\n"
        "   - When a table is generated, keep the introductory text to a single concise sentence and follow immediately with the Markdown table and source citation.\n"
        "4. NEVER add filler conversational intros or preambles (e.g., NEVER say 'Based on the database query results...', 'I can see that...', 'According to the data...', 'Sure! Here is...'). Start immediately with the direct answer.\n\n"
        "DATABASE SCHEMA & FAST LOOKUP GUIDE:\n"
        "1. Table `p&l`: Monthly columns are timestamp strings formatted as 'YYYY_MM_01_00:00:00' (e.g., March 2025 is \"2025_03_01_00:00:00\", Oct 2023 is \"2023_10_01_00:00:00\"). Metrics are in the `ledger_accounts` column (e.g. 'Software Revenue', 'Salaries CGS (Projects + Technical)', 'GROSS PROFIT', 'Gross Profit Margin %', 'Total OPEX').\n"
        "2. To lookup 'Software Revenue for March 2025', write: `SELECT \"2025_03_01_00:00:00\" AS mar_2025, _source_file FROM \"p&l\" WHERE LOWER(ledger_accounts) LIKE '%software revenue%'`.\n"
        "3. Table `monthly_payroll`: Columns include `team`, `designation`, `salary`, `month`, `_source_file`.\n"
        "4. Always cast text numbers when aggregating: `NULLIF(REGEXP_REPLACE(col, '[^0-9.-]', '', 'g'), '')::numeric`.\n\n"
        "STRICT MARKDOWN TABLE FORMATTING RULES:\n"
        "- When outputting tables, EVERY ROW MUST BE ON A SEPARATE NEW LINE (\\n). NEVER concatenate rows horizontally.\n"
        "- Every table MUST have a standard header divider row with hyphens: `| :--- | :--- | :--- |`.\n\n"
        "VISUALIZATION & CHART GENERATION RULES:\n"
        "- When the user asks for a chart, graph, plot, or visualization (e.g. 'show a chart', 'plot revenue', 'bar chart', 'line chart', 'pie chart', 'visualize trend'):\n"
        "- Output a brief explanation and ALWAYS append a ```chart code block with valid JSON formatted like this:\n"
        "```chart\n"
        "{\n"
        "  \"type\": \"bar\" | \"line\" | \"pie\",\n"
        "  \"data\": [\n"
        "    {\"name\": \"Oct 2023\", \"value\": 88661},\n"
        "    {\"name\": \"Nov 2023\", \"value\": 113661},\n"
        "    {\"name\": \"Dec 2023\", \"value\": 138661}\n"
        "  ],\n"
        "  \"xKey\": \"name\",\n"
        "  \"yKey\": \"value\"\n"
        "}\n"
        "```\n\n"
        "FOLLOW-UP CONTEXT CONTINUATION & METRIC ANCHOR RULES:\n"
        "1. ANCHOR TO ACTIVE METRIC & TABLE: When the user asks a follow-up without an explicit metric name (e.g. 'average for last 6 months', 'what about next year?', 'show monthly breakdown', 'compare with previous quarter', 'and for marketing?'):\n"
        "- You MUST identify the active financial metric (e.g. 'Travel & LEAP Expenses', 'Software Revenue', 'Salaries CGS', 'Gross Profit') and active table (e.g. 'p&l', 'monthly_payroll', 'kpi') from the immediately preceding conversation turn.\n"
        "- Answer the question STRICTLY for that active metric and table. NEVER jump to unrelated tables unless the user explicitly names a completely new subject.\n"
        "2. ROLLING WINDOW & TIME CONTINUATION (e.g. 'last 6 months', 'preceding 3 months'):\n"
        "- When asked for 'last 6 months' or 'average of past months' following a specific month (e.g. Jan 2025 in FY 2024-25), look at the preceding 6 monthly columns for that same metric.\n"
        "- Compute the exact average and output the result cleanly with source citation.\n"
        "3. MULTI-TURN MEMORY: Maintain active tracking of the user's conversational goal across the last 4 turns.\n\n"
        "DATABASE ENTITY GROUNDING RULES:\n"
        "- When a prompt includes '[DATABASE ENTITY GROUNDING: Canonical '[Name]' in table '[table]']', you MUST write your SQL query using that exact canonical name in your WHERE clause:\n"
        "  e.g., `WHERE LOWER(ledger_accounts) = LOWER('[Name]')` or `WHERE LOWER(ledger_accounts) LIKE '%[Name]%'\n"
        "- Corporate accounting entries often have compound names (e.g. 'Salaries Management/CSG', 'Travel & LEAP Expenses', 'Salaries CGS (Projects + Technical)'). ALWAYS use the grounded canonical name rather than guessing strings!\n\n"
        "STRICT ZERO-LEAK SECURITY DENIAL RULE:\n"
        "- If a query is denied by security or if the tool returns 'Security Authorization Error: You are not authorized to query the dataset...':\n"
        "- You MUST reply strictly with EXACTLY ONE short line: 'You do not have access to this data.'\n"
        "- NEVER leak internal database column names, formulas, cell addresses, filenames, or hints about what data exists!\n"
        "- If the user asked for multiple items where some are permitted and some restricted, answer ONLY the permitted part and add: 'You do not have access to [restricted item].'\n\n"
        "UNIVERSAL OUT-OF-SCOPE SCOPE GATE:\n"
        "- You are strictly an enterprise financial knowledge assistant built to query corporate datasets available in the Knowledgebase.\n"
        "- If the user asks ANY question that is not related to querying financial data, accounting workbooks, metrics, or the Finstant system (e.g. general knowledge, world history, trivia, coding/programming, creative writing, poetry, advice, science, recipes, weather, casual chatter):\n"
        "- You MUST reply strictly and ONLY with: 'Sorry, I cannot respond to this query. Ask me only questions related to your financial data uploaded.'\n"
        "- DO NOT attempt to answer out-of-scope questions, offer external facts, or engage in general conversation."
    )


    messages = []
    if chat_history:
        messages.extend(chat_history)
        
    messages.append(
        {"role": "user", "content": f"Available database schema: {json.dumps(schema_context)}\n\nQuestion: {user_question}"}
    )

    accumulated_lineage = []
    max_turns = 6
    turn = 0

    try:
        while turn < max_turns:
            print(f"--- LLM Turn {turn + 1} ---")
            
            # Force tool usage on the very first turn to prevent premature text answers
            force_tool = (turn == 0)
            message = call_llm(system_prompt, messages, tools, force_tool=force_tool)
            
            if not message.get("tool_calls"):
                print("LLM generated final text response.")
                final_text = message.get("content", "").strip()
                if not final_text:
                    final_text = "I could not generate a response for that query based on the available data."
                return {"final_text": final_text, "lineage": accumulated_lineage, "created_tables": [], "error": False}
                
            messages.append({
                "role": "assistant",
                "content": message.get("content", ""),
                "tool_calls": message.get("tool_calls")
            })
            
            tool_results = []
            for tc in message["tool_calls"]:
                func_name = tc.get("function", {}).get("name")
                arguments = tc.get("function", {}).get("arguments", {})
                
                print(f"Executing: {func_name} with args: {arguments}")
                
                if not validate_function_call(func_name, arguments, schema_context):
                    raw_result = {"result": "Invalid function call format or missing 'query' parameter.", "lineage": []}
                else:
                    raw_result = execute_function(user_id, func_name, arguments, step=turn+1)
                    accumulated_lineage.extend(raw_result.get("lineage", []))

                res_data = raw_result.get("result")
                # Format for LLM feedback
                if isinstance(res_data, str) and res_data.startswith("Postgres Syntax Error"):
                    res_str = res_data
                elif isinstance(res_data, str) and res_data.startswith("SQL Execution Error"):
                    res_str = res_data
                else:
                    res_str = json_to_csv(res_data)
                    
                if len(res_str) > 20000:
                    res_str = res_str[:20000] + "... (truncated)"

                print(f"Result (truncated): {res_str[:200]}")
                
                tool_results.append({
                    "type": "tool_result",
                    "name": func_name,
                    "content": res_str
                })

            # Feed the tool results back into the conversation for the next loop iteration
            # using the 'user' role to bypass the API's broken OpenAI-to-Anthropic translation layer
            messages.append({
                "role": "user",
                "content": f"Here are the database results from your query:\n\n{str(tool_results)}\n\nIf this data answers the question, provide the final answer. If you need more data or made a SQL mistake, write a new execute_read_only_sql query."
            })
            turn += 1

        print("Max turns reached without final answer.")
        return {
            "final_text": "I reached the maximum number of computational steps without finding a definitive answer. Please refine your query.",
            "lineage": accumulated_lineage,
            "created_tables": [],
            "error": False
        }

    except Exception as e:
        safe_err = str(e).encode("ascii", "replace").decode("ascii")
        print(f"Translator Error: {safe_err}")
        return {
            "final_text": f"Error communicating with AI engine: {safe_err}",
            "lineage": accumulated_lineage,
            "created_tables": [],
            "error": True
        }
