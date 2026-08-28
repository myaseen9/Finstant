# FINSTΛNT — Financial Knowledge Engine & Analytics Platform

FINSTΛNT is an enterprise-grade AI-powered financial knowledge engine that converts natural language queries into instantaneous, deterministic financial analytics, multi-turn ledger computations, and role-based data insights across corporate workbooks.

---

## Prerequisites (Before You Begin)

Ensure you have the following software installed on your machine:

1. **Python 3.11** (Verify: `python --version`)
2. **Node.js 18+ & npm** (Verify: `node -v` and `npm -v`)
3. **PostgreSQL 14+** (Verify: `psql --version` or `createdb --version`) running on port `5432`
4. **Git** (Verify: `git --version`) (Assuming git and github is already setup on pc)
5. **Visual Studio Code** (or your preferred IDE)
6. **AWS Account** (with administrative access to Amazon Cognito & IAM)

---

## Complete Setup Guide (Step-by-Step Flow)

```
1️⃣ Clone Repo ──► 2️⃣ PostgreSQL DB ──► 3️⃣ AWS Cognito & IAM ──► 4️⃣ Backend Setup ──► 5️⃣ Frontend Setup ──► 6️⃣ Launch System
```

---

### 1️⃣ Clone the Repository & Open in VS Code

Clone the repository:
```bash
git clone https://github.com/your-username/finance-knowledge-engine.git
```

Move into the project directory: (open terminal)
```bash
cd finstant
```

Open the codebase in VS Code:
```bash
code .
```

---

### 2️⃣ Database Setup (PostgreSQL Terminal Commands)

FINSTΛNT utilizes two PostgreSQL databases:
* `finstant_users`
* `finstant_kb`

#### Step 2.1: Create the Databases

Create the main application users database: (while creating enter your specified password to postgresql)

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

---

### 3️⃣ AWS Cognito & IAM Setup (Generate Cloud Credentials)

Before configuring your application `.env` files, configure Amazon Cognito to generate your **User Pool ID**, **App Client ID**, **IAM API Credentials**, and **Initial Super Admin**:

#### Step 3.1: Create the Cognito User Pool
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/) then navigte or search for **Amazon Cognito** (Select Region, e.g. `eu-north-1`).
2. Click the orange **"Create user pool"** button.
3. **Sign-in experience:**
   * Select **Email** and **Username**.
   * Click **Next**.
4. **Security requirements:**
   * Password policy: Select **Cognito defaults** (or custom organization policy).
   * Multi-factor authentication (MFA): Select **No MFA** (or Optional).
   * User account recovery: Select **Email only**.
   * Click **Next**.
5. **Sign-up experience:**
   * Self-service sign-up: **Uncheck "Enable self-registration"** (FINSTΛNT is invite-only via Admin).
   * Attribute verification: Check **"Allow Cognito to automatically send messages to verify and confirm"** → Select **Verify email address**.
   * Required attributes: Ensure `email`, `given_name`, and `family_name` are selected.
   * Click **Next**.
6. **Message delivery:**
   * Select **"Send email with Cognito"** (covers 50 free emails/day) or connect Amazon SES.
   * Click **Next**.
7. **Integrate your app:**
   * User pool name: `finstant-user-pool`
   * Initial app client name: `finstant-spa-client`
   * Client secret: **Select "Don't generate a client secret"** ⚠️ *(Critical: Next.js Single Page Applications must not use a client secret).*
   * Authentication flows: Ensure **`ALLOW_USER_SRP_AUTH`** and **`ALLOW_USER_PASSWORD_AUTH`** are checked.
   * Click **Next** → Review and click **"Create user pool"**.
8. **Save Credentials:**
   * Copy your **User Pool ID** (e.g. `eu-north-1_gKxHAvqPm`) and **App Client ID** (e.g. `6uasv2coagguknngksvupeg2a0`).

#### Step 3.2: Create User Groups (Roles)
1. Inside your User Pool, click on the **"Groups"** tab.
2. Click **"Create group"** and add the following 3 groups:
   * **`SuperAdmin`** (Precedence: `1`) — Full system authority, master upload, user deletion.
   * **`Admin`** (Precedence: `2`) — Financial uploads, user management, audit review.
   * **`User`** (Precedence: `3`) — Standard employee, restricted to assigned sheets.

#### Step 3.3: Create Programmatic IAM User for Backend API
To allow the FastAPI backend to invite new users and reset passwords via `boto3`:
1. In the AWS Console, search for **IAM** → Click **Users** → Click **"Create user"**.
2. **User name:** `finstant-cognito-backend-admin` (Leave console access unchecked).
3. Click **Next** → Under Permissions options, select **"Attach policies directly"**.
4. Search for and check: **`AmazonCognitoPowerUser`**.
5. Click **Next** → Click **"Create user"**.
6. Click on `finstant-cognito-backend-admin` → Go to the **"Security credentials"** tab.
7. Scroll down to **Access keys** → Click **"Create access key"** → Choose **"Application running outside AWS"**.
8. Copy your **Access Key ID** (`AKIA...`) and **Secret Access Key** (`VgOm...`).

#### Step 3.4: Create the Initial Super Admin User
1. Go back to **Amazon Cognito** → **User Pools** → Select your pool.
2. In the left sidebar, click **Users** → Click **"Create user"**.
3. Select **"Send an email invitation"**.
4. **Username / Email address:** Enter your **active, real corporate/personal email**.
5. Check **"Mark email address as verified"** → Select **"Generate a password"**.
6. Click **"Create user"**.
7. **Assign to SuperAdmin Group:**
   * Click on the newly created user's email → Scroll to **Group memberships** → Click **"Add user to group"**.
   * Select **`SuperAdmin`** → Click **Add**.
8. ⚠️ **Spam Folder Reminder:** AWS Cognito will send an automated invitation email with the subject *"Your temporary password"*. **Check your Spam / Junk folder** if the email is not in your primary inbox within 1–2 minutes.

---

### 4️⃣ Backend Setup (Terminal Commands & Environment)

Now that you have your database and AWS credentials ready, set up the backend:

Open a terminal in VS Code at the project root (`finstant`):

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
Create or edit `backend/.env` and paste your credentials:
```ini
# Database Connections
DATABASE_URL=postgresql://postgres:your_PASSWORD@localhost:5432/finstant_users
KB_INGESTION_URL=postgresql://postgres:your_PASSWORD@localhost:5432/finstant_kb
KB_DATABASE_URL=postgresql://finstant_kb_reader:kb_reader_secure_123@localhost:5432/finstant_kb

# LLM & Reasoning Model
AGENTROUTER_API_KEY=your_agentrouter_api_key
AGENTROUTER_MODEL=claude-opus-5

# AWS Cognito & IAM Credentials (From Step 3)
COGNITO_REGION=eu-north-1
COGNITO_USER_POOL_ID=aws_user_pool_id
COGNITO_APP_CLIENT_ID=cognito_app_client_key
AWS_ACCESS_KEY_ID=aws_access_key
AWS_SECRET_ACCESS_KEY=aws_secret_access_key
```

Start the FastAPI backend server:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
*(Backend will run at `http://127.0.0.1:8000`)*

---

### 5️⃣ Frontend Setup (Terminal Commands & Environment)

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
Create or edit `frontend/.env` and paste your Cognito IDs:
```ini
# Backend API URL
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# AWS Cognito Configuration (From Step 3)
NEXT_PUBLIC_COGNITO_REGION=eu-north-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=aws_userpool_id
NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=cognito_app_client_id
```

Start the Next.js frontend development server:
```bash
npm run dev
```
*(Frontend will run at `http://localhost:3000`)*

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

### 7️⃣ First-Time Super Admin Login

1. Open your browser and navigate to: **`http://localhost:3000/login`**
2. Enter the Super Admin email and the **Temporary Password** from your AWS invitation email.
3. On first login, the system will prompt you to set your **New Permanent Password**.
4. Once submitted, you are securely logged in and redirected to the dashboard!

---

### 8️⃣ Ingesting Financial Master Data

1. Navigate to the **Data Upload / Admin Portal** (`http://localhost:3000/upload` or via the left sidebar).
2. Upload your organization's Master Excel Workbook (`.xlsx`).
3. The system will automatically parse all sheets, normalize financial ledger headers, index entities into the Dynamic Semantic Grounder, and prepare the knowledge base for instant natural language queries.

## Insturctions for the user:

* If you have any changes in the database schema or finstant_db tables, then also change the schema in finstant/db_schemas 
* Must add .env / venv files in gitignore if working on codebase for security of keys.
## Enjoy using Finstant ! 
Developed by team WhiteWalkers at DPL during summer internship 2026.
Muhammad Yaseen
Muhammad Ahmad
Ramalah Amir
Bilawal Hussain