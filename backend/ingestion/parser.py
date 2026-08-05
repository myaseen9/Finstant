import pandas as pd
import os

class ExcelParser:
    def __init__(self, file_path):
        self.file_path = file_path
        self.file_name = os.path.basename(file_path)
    
    def parse_all_sheets(self):
        """
        Reads all sheets from the Excel file and returns a dictionary 
        mapping sheet names to pandas DataFrames.
        Adds lineage columns: _source_file, _sheet_name, _row_number.
        """
        print(f"Parsing {self.file_name}...")
        sheets_dict = pd.read_excel(self.file_path, sheet_name=None, engine='calamine')
        
        parsed_data = {}
        for sheet_name, df in sheets_dict.items():
            if df.empty:
                print(f"Skipping empty sheet: {sheet_name}")
                continue
                
            # Add lineage columns
            df['_source_file'] = self.file_name
            df['_sheet_name'] = sheet_name
            # index starts at 0, Excel rows usually start at 2 (assuming row 1 is header)
            df['_row_number'] = df.index + 2 
            
            # Clean column names for database (lowercase, replace spaces)
            df.columns = [str(col).strip().lower().replace(' ', '_').replace('-', '_') for col in df.columns]
            
            parsed_data[sheet_name] = df
            print(f"Parsed sheet '{sheet_name}' with {len(df)} rows.")
            
        return parsed_data
