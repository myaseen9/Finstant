-- Schema extracted from finstant_kb

CREATE TABLE dashboard_summary (
    month text,
    total_inflow double precision,
    total_outflow double precision,
    net_cash_flow double precision,
    cumulative_cash_balance double precision,
    total_payroll double precision,
    total_utilities double precision,
    total_vendor_spend double precision,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE cash_inflows (
    invoice_id text,
    invoice_date text,
    payment_date text,
    client_name text,
    client_industry text,
    region text,
    gross_amount double precision,
    tax_collected double precision,
    net_inflow double precision,
    payment_method text,
    status text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE vendor_directory (
    vendor_id text,
    vendor_name text,
    category text,
    contact_person text,
    email text,
    payment_terms text,
    tax_id text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE vendor_payments (
    transaction_id text,
    vendor_id text,
    vendor_name text,
    invoice_date text,
    payment_date text,
    amount double precision,
    category text,
    department_charged text,
    approval_status text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE utility_bills (
    bill_id text,
    service_month text,
    utility_type text,
    provider_name text,
    account_number text,
    bill_date text,
    due_date text,
    amount double precision,
    payment_status text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE employee_directory (
    employee_id text,
    first_name text,
    last_name text,
    department text,
    role text,
    date_of_hire text,
    employment_status text,
    base_salary_annual integer,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE payroll_logs (
    pay_period_end_date text,
    employee_id text,
    first_name text,
    last_name text,
    monthly_base_pay double precision,
    overtime_pay double precision,
    bonuses double precision,
    tax_withholding double precision,
    healthcare_deductions double precision,
    net_pay_distributed double precision,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE travel_and_expense (
    report_id text,
    employee_id text,
    employee_name text,
    expense_date text,
    category text,
    business_purpose text,
    total_amount double precision,
    approval_flow_status text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE capital_expenditures (
    asset_id text,
    purchase_date text,
    asset_description text,
    category text,
    department text,
    cost double precision,
    useful_life_years integer,
    depreciation_method text,
    monthly_depreciation_value double precision,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE tax_ledger (
    transaction_id text,
    tax_period text,
    tax_type text,
    filing_date text,
    payment_date text,
    amount_paid double precision,
    authority_name text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE debt_and_interest_schedule (
    loan_id text,
    lender_name text,
    principal_amount integer,
    annual_interest_rate double precision,
    start_date text,
    monthly_payment double precision,
    principal_paid_ytd double precision,
    interest_paid_ytd double precision,
    remaining_balance double precision,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

CREATE TABLE saas_and_subscriptions (
    subscription_id text,
    software_name text,
    vendor_name text,
    billing_frequency text,
    renewal_date text,
    number_of_seats integer,
    monthly_cost double precision,
    department_owner text,
    status text,
    _source_file text,
    _sheet_name text,
    _row_number integer
);

