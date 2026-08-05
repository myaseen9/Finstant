import pandas as pd
from sqlalchemy import MetaData, Table, Column, Integer, String, Float, Boolean, Text

class SchemaBuilder:
    def __init__(self, engine):
        self.engine = engine
        self.metadata = MetaData()
        
    def _map_dtype(self, pandas_dtype):
        """Maps pandas data types to SQLAlchemy column types."""
        if pd.api.types.is_integer_dtype(pandas_dtype):
            return Integer
        elif pd.api.types.is_float_dtype(pandas_dtype):
            return Float
        elif pd.api.types.is_bool_dtype(pandas_dtype):
            return Boolean
        else:
            return Text

    def build_and_create_tables(self, parsed_data):
        """
        Takes the dictionary of parsed sheets (DataFrames) and creates 
        PostgreSQL tables matching their schema dynamically.
        """
        for sheet_name, df in parsed_data.items():
            table_name = sheet_name.strip().lower().replace(' ', '_').replace('-', '_')
            
            columns = []
            for col_name, dtype in df.dtypes.items():
                # Lineage columns are text/integer
                if col_name == '_row_number':
                    col_type = Integer
                else:
                    col_type = self._map_dtype(dtype)
                    
                columns.append(Column(col_name, col_type))
                
            # Create Table object
            table = Table(table_name, self.metadata, *columns, extend_existing=True)
            print(f"Generated schema for table '{table_name}'.")
            
        # Create all tables in the database (ignores existing)
        print("Creating tables in PostgreSQL...")
        self.metadata.create_all(self.engine)
        print("Tables created successfully.")
