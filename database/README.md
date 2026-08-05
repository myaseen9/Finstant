# PostgreSQL Database Setup for Finstant

This document explains how to set up the local PostgreSQL database required for the `finstant` backend and data ingestion pipeline.

## 1. Install PostgreSQL (Windows)

If you do not already have PostgreSQL installed on your machine:
1. Download the interactive installer from the [EnterpriseDB website](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Run the installer.
3. During installation, it will ask for a **password** for the default `postgres` superuser. Note this password down (our default script assumes the password is `postgres`, but you can change it).
4. Leave the default port at `5432`.
5. Finish the installation (you do not need to launch Stack Builder).

## 2. Create the `finstant` Database

You can create the database using the **pgAdmin 4** GUI (which installs alongside PostgreSQL) or via the **SQL Shell (psql)** command line.

### Option A: Using pgAdmin 4
1. Open pgAdmin 4 from your Windows Start Menu.
2. Enter the password you set during installation.
3. In the left sidebar, expand **Servers** > **PostgreSQL**.
4. Right-click on **Databases** > **Create** > **Database...**
5. Name the database `finstant` and click **Save**.

### Option B: Using Command Line (psql)
If you have added `psql` to your system PATH:
```cmd
psql -U postgres -c "CREATE DATABASE finstant;"
```
*(It will prompt you for your postgres password).*

## 3. Python Virtual Environment Setup

Before running the ingestion scripts, set up your Python environment:

1. Open a terminal in the `finance-knowledge-engine/backend` folder.
2. Create a virtual environment:
   ```cmd
   python -m venv venv
   ```
3. Activate the virtual environment:
   ```cmd
   venv\Scripts\activate
   ```
4. Install the required dependencies:
   ```cmd
   pip install -r requirements.txt
   ```

## 4. Running the Ingestion Pipeline

To run the data ingestion tool against an Excel file, ensure your virtual environment is active, then run:

```cmd
python ingestion/run_ingestion.py "path/to/your/excel_file.xlsx"
```

If your postgres password is NOT `postgres`, you must provide the custom database URL:
```cmd
python ingestion/run_ingestion.py "path/to/your/excel_file.xlsx" --db_url postgresql://postgres:YOUR_PASSWORD@localhost:5432/finstant
```
