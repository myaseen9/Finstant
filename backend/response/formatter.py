import re

GENERIC_IDENTITY_RESPONSE = (
    "I'm Finstant, your financial data assistant. "
    "Ask me a question about your organization's uploaded financial data "
    "and I'll give you a direct answer sourced from your records."
)

FORBIDDEN_DISCLOSURE_TERMS = [
    "postgresql", "postgres", "finstant_kb", "finstant_users", "database",
    "sql", "bedrock", "anthropic", "claude", "cognito", "aws", "api key",
    "schema", "backend", "server", "localhost", "ec2"
]

def contains_disclosure_risk(response_text: str) -> bool:
    """
    Mandatory post-execution disclosure filter as a last line of defense.
    Catches infrastructure, database, cloud, and backend stack leaks.
    """
    lower = response_text.lower()
    for term in FORBIDDEN_DISCLOSURE_TERMS:
        if re.search(r'\b' + re.escape(term) + r'\b', lower):
            return True
    return False

def fix_markdown_tables(text: str) -> str:
    """
    Detects inline piped tables (where rows were concatenated on a single line like `| a | b | | c | d |`)
    and repairs them into valid multi-line Markdown tables with standard header dividers.
    """
    if not text:
        return ""
        
    # Replace double pipe boundaries `| |` with `|\n|`
    text = re.sub(r'\|\s*\|', '|\n|', text)
    
    lines = text.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # If this is a header row (starts and ends with |) and the next line is NOT a divider row
        trimmed = line.strip()
        if trimmed.startswith('|') and trimmed.endswith('|'):
            # Check if this is the start of a table
            is_prev_table = (i > 0 and lines[i-1].strip().startswith('|'))
            if not is_prev_table:
                # Check if next line is already a divider
                has_divider = (i + 1 < len(lines) and re.match(r'^\s*\|?\s*[-:]+[-| :]*\|?\s*$', lines[i+1].strip()))
                if not has_divider:
                    # Count columns in header
                    cols = [c.strip() for c in trimmed.split('|')[1:-1]]
                    if len(cols) >= 2:
                        divider = '| ' + ' | '.join([':---'] * len(cols)) + ' |'
                        new_lines.append(divider)
        i += 1
        
    return '\n'.join(new_lines)

def format_response(loop_result: dict) -> str:
    final_text = loop_result.get("final_text", "").strip()
    
    # Layer 7: Mandatory Disclosure Backstop (Last line of defense)
    if contains_disclosure_risk(final_text):
        print(f"[SECURITY ALERT] Disclosure backstop triggered! Technical disclosure risk caught in response: '{final_text[:120]}...'")
        return GENERIC_IDENTITY_RESPONSE
        
    return fix_markdown_tables(final_text)
