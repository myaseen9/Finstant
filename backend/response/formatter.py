def format_response(loop_result: dict) -> str:
    """
    Takes the multi-step reasoning result containing the LLM's generated final text
    and accumulated lineage, and appends the source citations securely.
    """
    final_text = loop_result.get("final_text", "").strip()
    lineage_data = loop_result.get("lineage", [])
    
    return final_text
