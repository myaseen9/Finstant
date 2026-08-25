# FINSTΛNT — Financial Knowledge Engine & Analytics Platform

FINSTΛNT is an enterprise-grade AI-powered financial knowledge engine that converts natural language queries into instantaneous, deterministic financial analytics, multi-turn ledger computations, and role-based data insights across corporate workbooks.

---

## Prerequisites (Before You Begin)

Ensure you have the following software installed on your machine:

1. **Python 3.10+** (Verify: `python --version`)
2. **Node.js 18+ & npm** (Verify: `node -v` and `npm -v`)
3. **PostgreSQL 14+** (Verify: `psql --version`) running on port `5432`
4. **Git** (Verify: `git --version`)
5. **Visual Studio Code** (or your preferred IDE)

---

## Complete Setup Guide (Step-by-Step)

### 1️⃣ Clone the Repository & Open in VS Code

Open your terminal (PowerShell, Command Prompt, or Git Bash):

```bash
# 1. Clone the repository
git clone https://github.com/your-username/finance-knowledge-engine.git

# 2. Move into the project directory
cd finance-knowledge-engine

# 3. Open the entire codebase in VS Code
code .
```

---

### 2️⃣ Database Setup (PostgreSQL)

FINSTΛNT utilizes two PostgreSQL databases:
* `finstant_users`: Manages authentication, user profiles, RBAC permissions, chat sessions, and audit logs.
* `finstant_kb`: Stores uploaded financial workbooks, normalized ledger tables, and knowledge data.

Open **SQL Shell (psql)** or run these commands in **pgAdmin Query Tool**:

```sql
-- Step 2.1: Create both application databases
CREATE DATABASE finstant_users;
CREATE DATABASE finstant_kb;

-- Step 2.2: Create a secure read-only user for safe SQL querying
CREATE USER finstant_kb_reader WITH PASSWORD 'kb_reader_secure_123';
GRANT CONNECT ON DATABASE finstant_kb TO finstant_kb_reader;

-- Step 2.3: Connect to the knowledge base database and set table permissions
\c finstant_kb
GRANT USAGE ON SCHEMA public TO finstant_kb_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finstant_kb_reader;
```

---

### 3️⃣ Backend Environment & Dependency Setup

Open a terminal inside VS Code at the project root (`finance-knowledge-engine`):

```bash
# 1. Navigate into the backend folder
cd backend

# 2. Create a virtual environment named 'venv'
python -m venv venv

# 3. Activate the virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (Command Prompt):
.\venv\Scripts\activate.bat
# macOS / Linux:
source venv/bin/activate

# 4. Install all required backend Python packages
pip install -r ../requirements.txt
```

#### Configure Backend `.env` File:
Create or edit the `.env` file inside the `backend/` directory:

```env
# PostgreSQL Database URLs
DATABASE_URL=postgresql://postgres:12345678@localhost:5432/finstant_users
KB_DATABASE_URL=postgresql://finstant_kb_reader:kb_reader_secure_123@localhost:5432/finstant_kb
KB_INGESTION_URL=postgresql://postgres:12345678@localhost:5432/finstant_kb

# LLM & AgentRouter API Configuration
AGENTROUTER_API_KEY=your_agentrouter_or_openrouter_api_key
AGENTROUTER_MODEL=claude-opus-5

# AWS Cognito Authentication Configuration
COGNITO_REGION=eu-north-1
COGNITO_USER_POOL_ID=your_cognito_user_pool_id
COGNITO_APP_CLIENT_ID=your_cognito_app_client_id
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

---

### 4️⃣ Frontend Dependency Setup

Open a **new terminal window** in VS Code:

```bash
# 1. Navigate into the frontend folder
cd frontend

# 2. Install all frontend JavaScript/React dependencies
npm install
```

---

### 5️⃣ User Handling via AWS Cognito (Creating the Initial Super Admin)

To establish your organization's first **Super Admin** account:

1. **Log in to the AWS Console:**
   * Navigate to **Amazon Cognito** -> **User Pools**.
   * Click on your configured user pool (`COGNITO_USER_POOL_ID`).
2. **Create the Super Admin User:**
   * In the left sidebar, click **Users** -> Click the orange **"Create user"** button.
   * Select **"Send an email invitation"**.
   * Enter a valid, **active corporate or personal email address** as the Username / Email.
   * Choose **"Generate a password"** (AWS will automatically create and email a temporary password).
   * Click **"Create user"**.
3. ⚠️ **Important Email Note:**
   * AWS Cognito will instantly dispatch an automated email with the subject *"Your temporary password"*.
   * **Check your Spam / Junk folder** if the email does not appear in your primary inbox within 1–2 minutes.

---

### 6️⃣ Starting the System

You can launch the complete system with one click or via manual terminals:

#### Option A: One-Click Windows Launcher (Recommended)
Double-click **`START_FINSTANT.bat`** in the project root folder. It will:
1. Start the FastAPI Backend on `http://127.0.0.1:8000`
2. Start the Next.js Frontend on `http://localhost:3000`
3. Automatically launch your default browser to `http://localhost:3000/login`

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

1. Navigate to the **Data Upload / Admin Portal** (`http://localhost:3000/upload`).
2. Upload your organization's Master Excel Workbook (`.xlsx`).
3. The system will automatically parse all sheets, normalize financial ledger headers, index entities into the Dynamic Semantic Grounder, and prepare the knowledge base for natural language queries.

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
* **Dynamic Semantic Grounder:** Automatically resolves non-verbatim accounting terms (`"salaries of management"` -> `"Salaries Management/CSG"`) across 100+ ledger lines.
* **4-Turn Context Memory:** Retains multi-turn entity anchors so users can drill down on rolling monthly metrics without repeating subjects.
* **Enterprise Query Audit:** Logs every query, cache hit, and security event into PostgreSQL for real-time compliance reporting.
