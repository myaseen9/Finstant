# FINSTΛNT — Financial Knowledge Engine & Analytics Platform

FINSTΛNT is an enterprise-grade AI-powered financial knowledge engine that converts natural language queries into instantaneous, deterministic financial analytics, multi-turn ledger computations, and role-based data insights across corporate workbooks.

---

## Prerequisites (Before You Begin)

Ensure you have the following software installed on your machine:

1. **Python 3.10+** (Verify: `python --version`)
2. **Node.js 18+ & npm** (Verify: `node -v` and `npm -v`)
3. **PostgreSQL 14+** (Verify: `psql --version` or `createdb --version`) running on port `5432`
4. **Git** (Verify: `git --version`)
5. **Visual Studio Code** (or your preferred IDE)

---

## Complete Setup Guide (Step-by-Step)

### 1️⃣ Clone the Repository & Open in VS Code

Clone the repository:
```bash
git clone https://github.com/your-username/finance-knowledge-engine.git
```

Move into the project directory:
```bash
cd finance-knowledge-engine
```

Open the codebase in VS Code:
```bash
code .
```

---

### 2️⃣ Database Setup (PostgreSQL Terminal Commands)

FINSTΛNT utilizes two PostgreSQL databases:
* `finstant_users`: Manages authentication, RBAC sheet permissions, chat sessions, and audit logs.
* `finstant_kb`: Stores uploaded financial workbooks, normalized ledger tables, and knowledge data.

#### Step 2.1: Create the Databases

Create the main users database:
```bash
createdb -U postgres finstant_users
```

Create the knowledge base database:
```bash
createdb -U postgres finstant_kb
```

#### Step 2.2: Apply the Canonical Schema

Apply the application users schema to `finstant_users`:
```bash
psql -U postgres -d finstant_users -f db_schemas/app_schema.sql
```

#### Step 2.3: Configure the Secure Read-Only Reader User

Create the read-only user and grant query permissions on `finstant_kb`:
```bash
psql -U postgres -d finstant_kb -c "CREATE USER finstant_kb_reader WITH PASSWORD 'kb_reader_secure_123'; GRANT CONNECT ON DATABASE finstant_kb TO finstant_kb_reader; GRANT USAGE ON SCHEMA public TO finstant_kb_reader; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finstant_kb_reader;"
```

#### 🔄 Fresh Database Reset (If you ever need to start completely fresh)

If you ever need to reset both databases (e.g. after testing or schema changes), drop and recreate:
```bash
dropdb -U postgres finstant_users
createdb -U postgres finstant_users
psql -U postgres -d finstant_users -f db_schemas/app_schema.sql

dropdb -U postgres finstant_kb
createdb -U postgres finstant_kb
psql -U postgres -d finstant_kb -c "CREATE USER finstant_kb_reader WITH PASSWORD 'kb_reader_secure_123'; GRANT CONNECT ON DATABASE finstant_kb TO finstant_kb_reader; GRANT USAGE ON SCHEMA public TO finstant_kb_reader; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finstant_kb_reader;"
```

> **Automated Alternative (Python):** You can also run `python setup_db.py` inside the `backend/` folder to automatically create databases, roles, and permissions in one step.

---

### 3️⃣ Backend Setup (Terminal Commands)

Open a terminal in VS Code at the project root (`finance-knowledge-engine`):

Navigate into the backend directory:
```bash
cd backend
```

Create a virtual environment named `venv`:
```bash
python -m venv venv
```

Activate the virtual environment:
* **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
* **Windows (Command Prompt):**
  ```cmd
  .\venv\Scripts\activate.bat
  ```
* **macOS / Linux:**
  ```bash
  source venv/bin/activate
  ```

Upgrade pip and install all backend requirements:
```bash
pip install -r ../requirements.txt
```

#### Configure Backend `.env` File:
Create or edit `backend/.env`:
```ini
# Database Connections
DATABASE_URL=postgresql://postgres:12345678@localhost:5432/finstant_users
KB_INGESTION_URL=postgresql://postgres:12345678@localhost:5432/finstant_kb
KB_DATABASE_URL=postgresql://finstant_kb_reader:kb_reader_secure_123@localhost:5432/finstant_kb

# LLM & Reasoning Model
AGENTROUTER_API_KEY=your_agentrouter_api_key
AGENTROUTER_MODEL=claude-opus-5

# AWS Cognito & IAM Credentials
COGNITO_REGION=eu-north-1
COGNITO_USER_POOL_ID=your_cognito_user_pool_id
COGNITO_APP_CLIENT_ID=your_cognito_app_client_id
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

Start the FastAPI backend server:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
*(Backend runs at `http://127.0.0.1:8000`)*

---

### 4️⃣ Frontend Setup (Terminal Commands)

Open a **new terminal tab** in VS Code:

Navigate into the frontend directory:
```bash
cd frontend
```

Install all frontend dependencies:
```bash
npm install
```

#### Configure Frontend `.env` File:
Create or edit `frontend/.env`:
```ini
# Backend API URL
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# AWS Cognito Configuration
NEXT_PUBLIC_COGNITO_REGION=eu-north-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your_cognito_user_pool_id
NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=your_cognito_app_client_id
```

Start the Next.js frontend development server:
```bash
npm run dev
```
*(Frontend runs at `http://localhost:3000`)*

---

### 5️⃣ User Handling via AWS Cognito (Creating the Initial Super Admin)

To establish your organization's first **Super Admin** account:

1. **Log in to the AWS Console:**
   * Navigate to **Amazon Cognito** → **User Pools**.
   * Click on your configured user pool (`COGNITO_USER_POOL_ID`).
2. **Create the Super Admin User:**
   * In the left sidebar, click **Users** → Click the orange **"Create user"** button.
   * Select **"Send an email invitation"**.
   * Enter a valid, **active corporate or personal email address** as the Username / Email.
   * Choose **"Generate a password"** (AWS will automatically create and email a temporary password).
   * Click **"Create user"**.
3. ⚠️ **Important Email Notice:**
   * AWS Cognito will instantly dispatch an automated email with the subject *"Your temporary password"*.
   * **Check your Spam / Junk folder** if the invitation email is not visible in your primary inbox within 1–2 minutes.

---

### 6️⃣ Starting the System

You can launch the complete system with one click or via manual terminals:

#### Option A: One-Click Windows Launcher (Recommended)
Double-click **`START_FINSTANT.bat`** in the project root folder. It will:
1. Start the FastAPI Backend on `http://127.0.0.1:8000`
2. Start the Next.js Frontend on `http://localhost:3000`
3. Automatically open your browser to `http://localhost:3000/login`

#### Option B: Manual Dual-Terminal Commands

**Terminal 1 (Backend):**
```bash
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

---

### 7️⃣ First-Time Login

1. Open your browser and navigate to: **`http://localhost:3000/login`**
2. Enter the Super Admin email and the **Temporary Password** from your AWS invitation email.
3. On first login, the system will prompt you to set your **New Permanent Password**.

---

### 8️⃣ Ingesting Financial Master Data

1. Navigate to the **Data Upload / Admin Portal** (`http://localhost:3000/upload` or via the left sidebar).
2. Upload your organization's Master Excel Workbook (`.xlsx`).
3. The system will automatically parse all sheets, normalize financial ledger headers, index entities into the Dynamic Semantic Grounder, and prepare the knowledge base for instant natural language queries.

---

### 9️⃣ Adding New Users & Role-Based Access Control (RBAC)

Admins and Super Admins can add team members directly from the web interface without touching the AWS console:

1. **Navigate to User Management:**
   * In the left navigation sidebar, click on **User Management** (`http://localhost:3000/users`).
2. **Click "Add User":**
   * Click the **"+ Add User"** button in the top right corner.
3. **Fill in User Details:**
   * **First Name** & **Last Name** (e.g. *John Doe*).
   * **Active Email Address:** Enter the user's real, active corporate email (e.g. *john.doe@company.com*). 
     > ⚠️ **Critical:** An active email is strictly required because AWS Cognito will immediately send their **Temporary Password** and login link to this address.
   * **Designation / Job Title:** (e.g. *Senior Financial Analyst*, *Operations Manager*).
   * **Role:**
     * `User` (Standard restricted employee — requires explicit sheet permissions).
     * `Admin` (Team manager — access to upload workbooks and view all datasets).
   * Click **"Create User"**.
4. **Temporary Password & Spam Folder Notice:**
   * The newly created user receives an automated welcome email with their temporary credentials.
   * Instruct the user to **check their Spam / Junk folder** if the invitation email is not visible in their primary inbox within 2 minutes.
5. **Assigning Sheet-Level Permissions (RBAC):**
   * On the user's card/row, click the **Permissions (Key 🔑)** icon.
   * Check the boxes for the exact dataset sheets this user is authorized to view (e.g., `p&l`, `monthly_payroll`, `headcount_teamwise`).
   * Click **"Save Permissions"**.
   * *Instant Layer-0 Security:* The user will be strictly barred from querying any unassigned sheets with 0 token leakage.
6. **User First-Time Login:**
   * The user opens `http://localhost:3000/login`, enters their temporary password, sets their new permanent password, and enters their sandboxed environment.
7. **Monitoring Query Analytics:**
   * Click the **Analytics (Chart 📊)** icon next to any user in User Management to inspect their query history, lookup/analytical breakdowns, and security denial logs.

---

## 🏗️ Architecture & Security Highlights

* **Layer-0 RBAC Guard (< 2ms):** Frontline verification intercepts unauthorized table access before LLM execution with zero schema leakage.
* **Dynamic Semantic Grounder:** Automatically resolves non-verbatim accounting terms (`"salaries of management"` → `"Salaries Management/CSG"`) across 100+ ledger lines.
* **4-Turn Context Memory:** Retains multi-turn entity anchors so users can drill down on rolling monthly metrics without repeating subjects.
* **Enterprise Query Audit:** Logs every query, cache hit, and security event into PostgreSQL for real-time compliance reporting.
