class DataLoader:
    def __init__(self, engine, db_url):
        self.engine = engine
        self.db_url = db_url
        
    def load_data(self, parsed_data):
        """
        Loads the pandas DataFrames into the corresponding PostgreSQL tables.
        """
        from sqlalchemy import inspect, text
        for sheet_name, df in parsed_data.items():
            table_name = sheet_name.strip().lower().replace(' ', '_').replace('-', '_')
            
            print(f"Loading data into '{table_name}'...")
            
            # Auto-migrate schema: Add any missing columns to the table before appending
            try:
                inspector = inspect(self.engine)
                if inspector.has_table(table_name):
                    existing_cols = [col['name'] for col in inspector.get_columns(table_name)]
                    with self.engine.begin() as conn:
                        for col in df.columns:
                            if col not in existing_cols:
                                print(f"Adding new column '{col}' to '{table_name}'")
                                # Use TEXT for new columns to be safe and avoid type conflicts
                                conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col}" TEXT'))
            except Exception as e:
                print(f"Schema auto-migration skipped/failed: {e}")
            
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
