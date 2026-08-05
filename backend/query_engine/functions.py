import json
from sqlalchemy import create_engine
import os

def get_engine():
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    return create_engine(db_url)

WHITELISTED_FUNCTIONS = {
    "filter": {
        "description": "Returns rows from a table where a specific column matches a filter value.",
        "parameters": {
            "table": "The name of the table to query.",
            "filter_column": "The column to filter on.",
            "filter_value": "The value to filter by.",
            "return_columns": "Optional. A comma-separated list of columns to return. Defaults to all."
        }
    },
    "aggregate": {
        "description": "Calculates an aggregate metric (sum, avg, count, max, min, count_distinct) on a column, optionally filtered.",
        "parameters": {
            "table": "The name of the table to query.",
            "operation": "The aggregate operation (sum, avg, count, max, min, count_distinct).",
            "value_column": "The column to aggregate.",
            "filter_column": "Optional. The column to filter on before aggregating.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "group_by": {
        "description": "Calculates totals per category (e.g. total spend per department or per month).",
        "parameters": {
            "table": "The name of the table.",
            "group_columns": "A comma-separated list of columns to group by (e.g. department, month).",
            "operation": "The aggregate operation (sum, avg, count, max, min).",
            "value_column": "The column to aggregate for each group.",
            "filter_column": "Optional. The column to filter on before grouping.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "sort": {
        "description": "Returns rows sorted by a specific column, useful for finding highest/lowest/top-N.",
        "parameters": {
            "table": "The name of the table.",
            "sort_column": "The column to sort by.",
            "direction": "The sort direction (ASC or DESC).",
            "limit": "Optional. Number of rows to return (e.g. 5 for top 5).",
            "filter_column": "Optional. The column to filter on before sorting.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "join": {
        "description": "Combines two related tables (e.g. employee_directory and travel_and_expense) on a common column.",
        "parameters": {
            "table1": "The first table name.",
            "table2": "The second table name.",
            "join_column": "The common column name present in both tables.",
            "return_columns": "Optional. A comma-separated list of columns to return.",
            "filter_column": "Optional. The column to filter on.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "compare": {
        "description": "Compares an aggregate value across two different filter values or periods.",
        "parameters": {
            "table": "The name of the table.",
            "operation": "The aggregate operation (sum, avg, count).",
            "value_column": "The column to aggregate.",
            "compare_column": "The column containing the two values to compare.",
            "value1": "The first value to filter and aggregate for.",
            "value2": "The second value to filter and aggregate for."
        }
    },
    "running_total": {
        "description": "Calculates the cumulative sum (running total) of a value column ordered by date.",
        "parameters": {
            "table": "The name of the table.",
            "value_column": "The column to sum cumulatively.",
            "order_column": "The date column to order the running total by.",
            "group_column": "Optional. Calculate running total partitioned by this group.",
            "filter_column": "Optional. The column to filter on.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "trend": {
        "description": "Calculates the period-over-period percentage change (growth rate) of a metric.",
        "parameters": {
            "table": "The name of the table.",
            "value_column": "The column to aggregate (sum).",
            "date_column": "The date column.",
            "period": "The period to group by (month, quarter, year).",
            "filter_column": "Optional. The column to filter on.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "percentage_of_total": {
        "description": "Calculates what percentage each group is of the total (e.g. what % of total spend is vendor X).",
        "parameters": {
            "table": "The name of the table.",
            "value_column": "The column to sum.",
            "group_column": "The column to group by.",
            "filter_column": "Optional. The column to filter on.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "rank_within_group": {
        "description": "Ranks items within their categories (e.g. Top vendor per department).",
        "parameters": {
            "table": "The name of the table.",
            "value_column": "The numeric column to rank by.",
            "group_column": "The column defining the categories (e.g. department).",
            "direction": "Sort direction (DESC for top, ASC for bottom).",
            "limit_per_group": "Number of top results to keep per group."
        }
    },
    "variance": {
        "description": "Calculates Budget vs. Actual, returning the difference and % variance.",
        "parameters": {
            "table": "The name of the table.",
            "actual_column": "The column containing actual spend/revenue.",
            "budget_column": "The column containing budgeted spend/revenue.",
            "group_column": "Optional. The column to group the variance by.",
            "filter_column": "Optional. The column to filter on.",
            "filter_value": "Optional. The value to filter by."
        }
    },
    "forecast": {
        "description": "Simple linear projection for a future period. Restricted to linear_trend only.",
        "parameters": {
            "table": "The name of the table.",
            "value_column": "The column to forecast.",
            "date_column": "The date column.",
            "periods_ahead": "Number of future periods to predict.",
            "method": "Must be 'linear_trend'."
        }
    }
}

def validate_function_call(func_name: str, args: dict, schema_context: dict = None) -> bool:
    """
    Validates a function call against the whitelist, checks required parameters,
    and verifies table/column names exist in the real database schema.
    """
    # 1. Check function exists
    if func_name not in WHITELISTED_FUNCTIONS:
        print(f"Validation failed: Unknown function '{func_name}'")
        return False

    spec = WHITELISTED_FUNCTIONS[func_name]

    # 2. Check required parameters are present and non-empty
    for param_name, param_desc in spec["parameters"].items():
        if "Optional" not in param_desc:
            val = args.get(param_name)
            if not val or str(val).strip() == "":
                print(f"Validation failed: Required parameter '{param_name}' is missing or empty for function '{func_name}'")
                return False

    # 3. If no schema context provided, skip schema validation
    if not schema_context:
        return True

    # 4. Verify table names exist in the real schema
    table_params = ["table", "table1", "table2"]
    for tp in table_params:
        if tp in args and args[tp]:
            table_name = args[tp].strip()
            if table_name not in schema_context:
                print(f"Validation failed: Table '{table_name}' does not exist in the database schema")
                return False

    # 5. Verify column names exist in their respective tables
    table_name = args.get("table", "").strip()
    if table_name and table_name in schema_context:
        table_columns = schema_context[table_name]
        column_params = [k for k in args.keys() if k.endswith("_column") or k == "group_columns"]
        for cp in column_params:
            col_val = args[cp].strip() if args.get(cp) else ""
            if not col_val:
                continue
            # group_columns can be comma-separated
            if cp == "group_columns":
                cols = [c.strip() for c in col_val.split(",")]
            else:
                cols = [col_val]
            for col in cols:
                if col and col not in table_columns:
                    print(f"Validation failed: Column '{col}' does not exist in table '{table_name}'. Available: {table_columns}")
                    return False

    return True

