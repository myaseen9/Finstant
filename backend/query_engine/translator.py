import os
import requests
from .functions import WHITELISTED_FUNCTIONS, validate_function_call
from .executor import execute_function
import json
from dotenv import load_dotenv
from .fast_router import route_query

load_dotenv()

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")


def call_llm(messages, tools):
    """Local-only LLM call via Ollama. No external API calls, ever."""
    response = requests.post(
        f"{OLLAMA_HOST}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "messages": messages,
            "tools": tools,
            "stream": False,
            "options": {"temperature": 0.0}
        },
        timeout=180
    )
    response.raise_for_status()
    try:
        data = response.json()
    except ValueError:
        raise Exception(f"Failed to parse JSON from Ollama. Response: {response.text[:200]}")
    return data.get("message", {})


def build_tools_payload():
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
                "parameters": {"type": "object", "properties": properties, "required": required}
            }
        })
    return tools


def run_query_loop(user_id: int, user_question: str, schema_context: dict) -> dict:
    """
    Executes a 3-layer fast query routing cascade.
    Layer 1: Regex pattern matching (milliseconds)
    Layer 2: Semantic embedding matching (~50ms)
    Layer 3: Local LLM function-calling via Ollama (fallback)
    """
    tools = build_tools_payload()

    system_prompt = (
        "You are FINSTANT, an elite financial data analyst. "
        "Your task is to answer the user's question by selecting the correct function from the available tools. "
        "The available functions are: filter, aggregate, group_by, sort, join, compare, running_total, trend, "
        "percentage_of_total, rank_within_group, variance, and forecast. "
        "You MUST call exactly one of these functions with the correct parameters. "
        "IMPORTANT: You MUST ALWAYS include `_source_file`, `_sheet_name`, and `_row_number` in your reasoning so you can cite your sources.\n\n"
        "After the tool returns the results, you MUST output the final answer strictly following these rules:\n"
        "1. Reply in natural textual language with a concise, instantly readable sentence.\n"
        "2. Return EXACTLY what was asked. Provide NO additional context, NO year-over-year comparisons, NO additional summary, and NO extra fluff.\n"
        "3. You MUST append a citation on a new line EXACTLY like this: 'Source: [_sheet_name] sheet, \"[row_identifier]\" row, [Column Name] column \u2014 [_source_file].'\n"
        "4. DO NOT use markdown tables UNLESS the user explicitly asks for a list or similar data across multiple items (e.g. 'List down all employees...'). For simple queries, do NOT output a table.\n"
        "5. Do not hallucinate numbers. Rely ONLY on the results returned by the tool.\n"
        "6. IMPORTANT IDENTITY RULE: If the user asks who you are, what your name is, who developed you, or any question about your identity, you MUST reply EXACTLY with this phrase and NOTHING ELSE: 'I am FINSTANT an intelligent system to asssit you by instant look ups and computations developed by Rebelious WhiteWhalkers at DPL.'"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Available database schema: {json.dumps(schema_context)}\n\nQuestion: {user_question}"}
    ]

    accumulated_lineage = []

    try:
        # --- FAST ROUTING (Layers 1 and 2) ---
        print("--- Attempting Fast Query Routing ---")
        fast_func, fast_args, layer_used = route_query(user_question, schema_context)

        if fast_func and fast_args:
            print(f"[{layer_used}] Confident Match: {fast_func} with args: {fast_args}")
            raw_result = execute_function(user_id, fast_func, fast_args, step=1)
            accumulated_lineage.extend(raw_result.get("lineage", []))

            res_data = raw_result.get("result")
            res_str = str(res_data)
            if len(res_str) > 2000:
                res_str = res_str[:2000] + "... (truncated)"

            messages.append({
                "role": "user",
                "content": f"The query was successfully routed to the '{fast_func}' function. Here is the raw data result:\n\n{res_str}"
            })
        else:
            # --- FALLBACK (Layer 3 LLM) ---
            print(f"[{layer_used}] No match found. Falling back to LLM generative routing.")
            message = call_llm(messages, tools)

            print(f"Received message: {json.dumps(message, indent=2)}")

            if "content" not in message or message["content"] is None:
                message["content"] = ""

            messages.append(message)

            tool_calls = message.get("tool_calls")
            if not tool_calls:
                print("No tool calls, returning early text.")
                final_text = message.get("content", "").strip()
                if not final_text:
                    final_text = "I could not process that query."
                return {"final_text": final_text, "lineage": [], "created_tables": [], "error": False}

            # Execute all requested tools
            for tc in tool_calls:
                func_name = tc.get("function", {}).get("name")
                arguments = tc.get("function", {}).get("arguments", {})
                if isinstance(arguments, str):
                    try:
                        arguments = json.loads(arguments)
                    except:
                        arguments = {}

                if not validate_function_call(func_name, arguments, schema_context):
                    raw_result = {"result": "Invalid function call", "lineage": []}
                else:
                    raw_result = execute_function(user_id, func_name, arguments, step=1)
                    accumulated_lineage.extend(raw_result.get("lineage", []))

                res_data = raw_result.get("result")
                res_str = str(res_data)
                if len(res_str) > 2000:
                    res_str = res_str[:2000] + "... (truncated)"

                print(f"Tool {func_name} result: {res_str[:500]}")

                tool_call_id = tc.get("id", "call_1")
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": func_name,
                    "content": res_str
                })

        # Step 2: Format the results
        print("--- STEP 2: Formatting Results ---")
        messages.append({
            "role": "user",
            "content": "Using the data results provided above, output the final answer formatted strictly according to the system prompt rules (concise, instant, no fluff, source citation appended, and absolutely NO tables unless explicitly requested for a list). Do not explain the query."
        })
        final_message = call_llm(messages, tools=None)

        final_text = final_message.get("content", "").strip()

        return {
            "final_text": final_text,
            "lineage": accumulated_lineage,
            "created_tables": [],
            "error": False
        }

    except Exception as e:
        print(f"Translator Error: {e}")
        return {
            "final_text": f"Error communicating with language model: {str(e)}",
            "lineage": accumulated_lineage,
            "created_tables": [],
            "error": True
        }
