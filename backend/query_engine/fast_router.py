import re
from typing import Dict, Any, Tuple, Optional
from fuzzywuzzy import process
import numpy as np
from fastembed import TextEmbedding
from sklearn.metrics.pairwise import cosine_similarity
import json
import os

# Initialize the embedding model (runs on CPU)
MODEL_NAME = 'BAAI/bge-small-en-v1.5'
_model = None

def get_embedding_model():
    global _model
    if _model is None:
        _model = TextEmbedding(MODEL_NAME)
    return _model

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
        
    # Attempt to guess table
    best_table = process.extractOne(user_question, all_tables)
    if best_table and best_table[1] > 60:
        args["table"] = best_table[0]
    else:
        # Default to first table if we can't guess
        args["table"] = all_tables[0] if all_tables else "unknown_table"

    # Common extraction logic based on function type
    if matched_func in ["aggregate", "group_by", "running_total", "trend", "percentage_of_total", "rank_within_group"]:
        # Find numeric columns for value_column
        best_col = process.extractOne("amount total salary expense revenue spend", all_columns)
        args["value_column"] = best_col[0] if best_col else "amount"
        
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
        
    # Add dummy filter matching for the sake of the deterministic requirement
    # Real deterministic matching would require a massive regex engine and NER models.
    
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
