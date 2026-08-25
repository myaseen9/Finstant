import pandas as pd
import os

class ExcelParser:
    def __init__(self, file_path):
        self.file_path = file_path
        self.file_name = os.path.basename(file_path)
    
    def parse_all_sheets(self):
        """
        Reads all sheets from the Excel file and intelligently finds the true table headers,
        skipping over any junk text or blank rows at the top of the sheets.
        Adds lineage columns: _source_file, _sheet_name, _row_number.
        """
        print(f"Parsing {self.file_name}...")
        
        parsed_data = {}
        excel_file = pd.ExcelFile(self.file_path)
        
        for sheet_name in excel_file.sheet_names:
            # Read without assuming row 0 is the header
            df_raw = pd.read_excel(self.file_path, sheet_name=sheet_name, header=None)
            
            if df_raw.empty:
                print(f"Skipping empty sheet: {sheet_name}")
                continue
                
            # Drop rows that are completely entirely empty across all columns to clean up calculation
            df_raw.dropna(how='all', inplace=True)
            
            if df_raw.empty:
                continue

            # Find the true header row by looking for the row in the first 20 rows
            # with the maximum number of non-null (string/data) values.
            # Table headers typically have a value for almost every column, while 
            # title text (like "Gross Profit %") only occupies one or two cells.
            top_rows = df_raw.head(20)
            non_null_counts = top_rows.notna().sum(axis=1)
            
            if non_null_counts.empty or non_null_counts.max() == 0:
                continue
                
            header_idx = non_null_counts.idxmax()
            
            # Extract the headers from the calculated header row
            headers = df_raw.loc[header_idx].astype(str).str.strip().tolist()
            
            # Slice the dataframe to grab everything below the header row
            df = df_raw.loc[header_idx + 1:].copy()
            df.columns = headers
            
            # Clean up the column names for PostgreSQL compatibility
            df.columns = [str(col).lower().replace(' ', '_').replace('-', '_') for col in df.columns]
            
            # Add lineage columns
            df['_source_file'] = self.file_name
            df['_sheet_name'] = sheet_name
            
            # Re-index nicely and set row numbers
            df.reset_index(drop=True, inplace=True)
            # Row number relative to the original excel sheet (header_idx is 0-indexed, so data starts at header_idx + 2)
            df['_row_number'] = df.index + header_idx + 2 
            
            parsed_data[sheet_name] = df
            print(f"Parsed sheet '{sheet_name}' with {len(df)} rows. True header found at row {header_idx + 1}.")
            
        return parsed_data
