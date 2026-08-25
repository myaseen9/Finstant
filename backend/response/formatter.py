import re

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
    return fix_markdown_tables(final_text)
