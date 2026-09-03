import os
import requests
from .functions import WHITELISTED_FUNCTIONS, validate_function_call
from .executor import execute_function
import json
from dotenv import load_dotenv

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

def call_agentrouter(system_instruction: str, messages: list, tools=None, force_tool=False):
    """Direct API call strictly using claude-opus-5 on AgentRouter."""
    API_KEY = os.environ.get("AGENTROUTER_API_KEY")
    if not API_KEY:
        raise Exception("AGENTROUTER_API_KEY is not set in the .env file")
        
    MODEL = os.environ.get("AGENTROUTER_MODEL", "claude-opus-5")
    url = "https://agentrouter.org/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
        "User-Agent": "claude-cli/1.0.60 (external, cli)"
    }
        
    formatted_messages = [{"role": "system", "content": system_instruction}]
    for m in messages:
        if m["role"] == "system": continue
        if isinstance(m["content"], str):
            formatted_messages.append({"role": m["role"], "content": m["content"]})
            
    payload = {
        "model": MODEL,
        "messages": formatted_messages,
        "temperature": 0.0
    }
    
    if tools:
        payload["tools"] = tools
        if force_tool:
            payload["tool_choice"] = "required"
        else:
            payload["tool_choice"] = "auto"

    import time
    response = None
    last_error = ""

    for attempt in range(4):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
        except Exception as net_err:
            if attempt < 3:
                time.sleep(1.0 * (attempt + 1))
                continue
            raise Exception(f"Connection to AI API failed: {net_err}")
        
        if response.status_code in [503, 429] and attempt < 3:
            time.sleep(2 ** attempt)
            continue
            
        if response.status_code == 200:
            break
        else:
            last_error = response.text
            if API_KEY in last_error:
                last_error = last_error.replace(API_KEY, "********")
            if attempt < 3:
                time.sleep(1.0)
                continue
            raise Exception(f"AI Engine Error ({response.status_code}): {last_error}")
        
    data = response.json()
    message_obj = data["choices"][0]["message"]
    
    tool_calls = []
    if "tool_calls" in message_obj and message_obj["tool_calls"]:
        for tc in message_obj["tool_calls"]:
            if tc["type"] == "function":
                args = {}
                try:
                    args = json.loads(tc["function"]["arguments"])
                except Exception:
                    pass
                tool_calls.append({
                    "id": tc["id"],
                    "function": {
                        "name": tc["function"]["name"],
                        "arguments": args
                    }
                })
                
    return {
        "role": "assistant",
        "content": message_obj.get("content") or "",
        "tool_calls": tool_calls
    }

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
        "You are FINSTΛNT, an AI-powered financial intelligence engine developed to process queries regarding available data in Knowledgebase. When asked who you are, who built you, or to introduce yourself, reply strictly with: 'I am FINSTΛNT, an AI-powered financial intelligence engine developed to process your queries regarding available data in Knowledgebase, what would you like to ask?'\n\n"
        "DATABASE SCHEMA & FAST LOOKUP GUIDE:\n"

        "1. Table `p&l`: Monthly columns are timestamp strings formatted as 'YYYY_MM_01_00:00:00' (e.g., March 2025 is \"2025_03_01_00:00:00\", Oct 2023 is \"2023_10_01_00:00:00\"). Metrics are in the `ledger_accounts` column (e.g. 'Software Revenue', 'Salaries CGS (Projects + Technical)', 'GROSS PROFIT', 'Total OPEX').\n"
        "2. To lookup 'Software Revenue for March 2025', write: `SELECT \"2025_03_01_00:00:00\" AS mar_2025, _source_file FROM \"p&l\" WHERE LOWER(ledger_accounts) LIKE '%software revenue%'`.\n"
        "3. Table `monthly_payroll`: Columns include `team`, `designation`, `salary`, `month`, `_source_file`.\n"
        "4. Always cast text numbers when aggregating: `NULLIF(REGEXP_REPLACE(col, '[^0-9.-]', '', 'g'), '')::numeric`.\n\n"
        "STRICT 3-TIER RESPONSE FORMATTING RULES:\n\n"
        "TIER 1 — DIRECT LOOKUP / SINGLE FACT QUESTION:\n"
        "- When asked for a single value (e.g. 'What was the software revenue for March 2025?'):\n"
        "- Reply in EXACTLY ONE natural textual sentence: 'Software Revenue for March 2025 was PKR 225,000.'\n"
        "- DO NOT generate any tables or extra commentary.\n"
        "- ALWAYS cite your source on a new line: 'Source: [sheet] sheet, [metric] row, [Column] column — [file].'\n\n"
        "TIER 2 — MULTI-MONTH, THRESHOLD FILTER, OR MULTI-ITEM BREAKDOWNS:\n"
        "- When a question involves multiple months, threshold filters (e.g. 'In how many/which months did X exceed Y?', 'List all months where...', 'Show breakdown of expenses'):\n"
        "- ALWAYS state the summary sentence, followed immediately by a clean Markdown Table listing each matching month and amount.\n"
        "- Example:\n"
        "Travel & LEAP Expenses exceeded PKR 5,000 in 3 months of FY 2024-25:\n\n"
        "| Month | Financial Year | Travel & LEAP Expenses |\n"
        "| :--- | :--- | :--- |\n"
        "| Oct 2024 | FY 2024-25 | PKR 6,545.37 |\n"
        "| Jan 2025 | FY 2024-25 | PKR 6,036.00 |\n"
        "| May 2025 | FY 2024-25 | PKR 5,102.40 |\n\n"
        "Source: P&L sheet, Travel & LEAP Expenses row — FY_2024-25_data_-_Dummy.xlsx.\n\n"
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
        "- Answer the question STRICTLY for that active metric and table. NEVER jump to unrelated tables (such as 'project_health' or 'audit_log') unless the user explicitly names a completely new subject.\n"
        "2. ROLLING WINDOW & TIME CONTINUATION (e.g. 'last 6 months', 'preceding 3 months'):\n"
        "- When asked for 'last 6 months' or 'average of past months' following a specific month (e.g. Jan 2025 in FY 2024-25), look at the preceding 6 monthly columns for that same metric (e.g. Aug 2024, Sep 2024, Oct 2024, Nov 2024, Dec 2024, Jan 2025).\n"
        "- Compute the exact average and output a clean Tier 2 Markdown Table showing each month's value and the overall average row!\n"
        "3. MULTI-TURN MEMORY (LAST 4 TURNS):\n"
        "- Maintain active tracking of the user's conversational goal across the last 4 turns (e.g. comparing metrics, drilling down into subcategories, or exploring trends over time).\n\n"
        "DATABASE ENTITY GROUNDING RULES:\n"
        "- When a prompt includes '[DATABASE ENTITY GROUNDING: Canonical '[Name]' in table '[table]']', you MUST write your SQL query using that exact canonical name in your WHERE clause:\n"
        "  e.g., `WHERE LOWER(ledger_accounts) = LOWER('[Name]')` or `WHERE LOWER(ledger_accounts) LIKE '%[Name]%'\n"
        "- Corporate accounting entries often have compound names (e.g. 'Salaries Management/CSG', 'Travel & LEAP Expenses', 'Salaries CGS (Projects + Technical)'). ALWAYS use the grounded canonical name rather than guessing strings!\n\n"
        "STRICT ZERO-LEAK SECURITY DENIAL RULE:\n"
        "- If a query is denied by security or if the tool returns 'Security Authorization Error: You are not authorized to query the dataset...':\n"
        "- You MUST reply strictly with EXACTLY ONE short line: 'You do not have access to this data.'\n"
        "- NEVER leak internal database column names, formulas, cell addresses, filenames, or hints about what data exists!\n"
        "- If the user asked for multiple items where some are permitted and some restricted, answer ONLY the permitted part and add: 'You do not have access to [restricted item].'"
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
            message = call_agentrouter(system_prompt, messages, tools, force_tool=force_tool)
            
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
