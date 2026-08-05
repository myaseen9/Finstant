class DataLoader:
    def __init__(self, engine, db_url):
        self.engine = engine
        self.db_url = db_url
        
    def load_data(self, parsed_data):
        """
        Loads the pandas DataFrames into the corresponding PostgreSQL tables.
        """
        for sheet_name, df in parsed_data.items():
            table_name = sheet_name.strip().lower().replace(' ', '_').replace('-', '_')
            
            print(f"Loading data into '{table_name}'...")
            
            # Passing the raw connection string bypasses the SQLAlchemy object detection bug
            df.to_sql(
                name=table_name,
                con=self.db_url,
                if_exists='append',
                index=False,
                method='multi',
                chunksize=1000
            )
            print(f"Successfully loaded {len(df)} rows into '{table_name}'.")
