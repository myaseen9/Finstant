import os
import argparse
from sqlalchemy import create_engine
try:
    from .parser import ExcelParser
    from .schema_builder import SchemaBuilder
    from .loader import DataLoader
except (ImportError, ValueError):
    from parser import ExcelParser
    from schema_builder import SchemaBuilder
    from loader import DataLoader


def main():
    parser = argparse.ArgumentParser(description="Ingest Excel files into PostgreSQL")
    parser.add_argument("file_path", help="Path to the Excel file to ingest")
    parser.add_argument("--db_url", default="postgresql://postgres:12345678@localhost:5432/finstant", 
                        help="PostgreSQL connection URL")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.file_path):
        print(f"Error: File '{args.file_path}' does not exist.")
        return

    print("--- Starting Data Ingestion Pipeline ---")
    
    # 1. Parse Excel File
    excel_parser = ExcelParser(args.file_path)
    parsed_data = excel_parser.parse_all_sheets()
    
    if not parsed_data:
        print("No valid data found in the provided Excel file. Exiting.")
        return
        
    # Connect to Database
    print(f"Connecting to database...")
    try:
        engine = create_engine(args.db_url)
        # Test connection
        with engine.connect() as conn:
            pass
    except Exception as e:
        print(f"Failed to connect to database. Ensure PostgreSQL is running and the database exists. Error: {e}")
        return

    # 2. Build Schema & Create Tables
    schema_builder = SchemaBuilder(engine)
    schema_builder.build_and_create_tables(parsed_data)
    
    # 3. Load Data
    loader = DataLoader(engine, args.db_url)
    loader.load_data(parsed_data)
    
    print("--- Ingestion Pipeline Completed Successfully ---")

if __name__ == "__main__":
    main()

