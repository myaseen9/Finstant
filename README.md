# FINSTΛNT — Airtight AWS Bedrock Deployment & Setup Guide

## What is FINSTΛNT?

**FINSTΛNT** is an enterprise-grade AI-powered financial knowledge engine built for corporate organizations. It allows finance teams and analysts to query their organization's actual financial data — payroll, revenue, headcount, KPIs, and more — using plain natural language, without needing to know SQL or touch a spreadsheet. The system ingests corporate Excel workbooks (`.xlsx`), structures the data into a secure PostgreSQL knowledge base, and uses an AI reasoning engine to translate questions like *"What was our total payroll cost in August?"* into precise, deterministic answers sourced directly from your organization's own data.

FINSTΛNT is role-based: **SuperAdmins** control the system and upload master data, **Admins** manage users and sheet access, and **Users** can only query the sheets they have been explicitly assigned. All chat history, audit logs, and session data is stored securely in a separate application database, completely isolated from the financial knowledge base.

## Why AWS Bedrock for AI?

FINSTΛNT uses **AWS Bedrock** as its exclusive AI engine in production — and this is a deliberate, security-first architectural decision:

- **Your data never leaves AWS.** Every financial query (salaries, margins, headcounts) is processed entirely within your AWS Virtual Private Cloud (VPC). No data is sent to any third-party server.
- **AWS legally guarantees zero model training on your data.** Unlike personal API subscriptions, AWS Bedrock's enterprise contracts explicitly prohibit the use of your prompts or responses to train or improve any AI model.
- **No external API keys that can leak or expire.** Authentication is handled purely through AWS IAM roles, which are tied to your AWS account identity. There are no third-party API billing limits that can suddenly block your system mid-month.
- **Enterprise scalability on demand.** Bedrock scales to your organization's usage. Throughput quotas can be raised directly from the AWS Console — no waiting for credit top-ups.

## Predicted Monthly Cost (Pay-As-You-Go)

FINSTΛNT runs entirely on AWS's pay-as-you-go model — you pay only for what you use, with no subscriptions, no seat licences, and no minimum commitment. For a typical department running around 100 queries a month, the combined cost of **AWS Bedrock + EC2 is approximately $3–$5/month**. AWS EC2 only charges when the instance is running, so stopping it outside office hours or on weekends brings the cost down further — you only pay for storage when it is off. Amazon Cognito for user authentication is free up to 50,000 monthly active users, and the PostgreSQL databases run on the same EC2 instance at no extra cost.

> **Production Runbook**  
> Pure step-by-step commands to deploy **FINSTΛNT** to a fresh AWS EC2 Ubuntu instance using **AWS Bedrock exclusively**.

---

## Terminal Key & Roles

To avoid confusion, each step clearly marks which terminal you must use:
- **`[LOCAL TERMINAL]`**: PowerShell / Bash on your personal PC.
- **`[EC2 TERMINAL]`**: SSH session connected to your remote AWS Ubuntu server.

---

## 1️⃣ Local Machine: Clone Repository

Open **`[LOCAL TERMINAL]`** on your computer:

```bash
# Clone the repository
git clone https://github.com/myaseen9/Finstant.git

# Enter project directory
cd Finstant
```

---

## 2️⃣ AWS Cloud Setup (Cognito, IAM & Bedrock)

You can run these using the **AWS CLI** in **`[LOCAL TERMINAL]`** (if configured) or in the **AWS CloudShell**:

### 2.1 Enable Bedrock Model Access
1. In the AWS Console, open **Amazon Bedrock** in `us-east-1` (or your preferred region).
2. Click **Model access** &rarr; **Modify model access**.
3. Check:
   - `Claude 3.5 Haiku` (`us.anthropic.claude-3-5-haiku-20241022-v1:0`)
   - `Claude 3.5 Sonnet` (`us.anthropic.claude-3-5-sonnet-20241022-v2:0`)
4. Click **Next** &rarr; **Submit**.

### 2.2 Create Cognito User Pool
```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name "finstant-user-pool" \
  --auto-verified-attributes email \
  --username-attributes email \
  --region us-east-1
```
*(Save the returned `Id`, e.g., `us-east-1_xxxxxxxxx`)*

### 2.3 Create Cognito App Client (SPA No-Secret)
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id "<YOUR_USER_POOL_ID>" \
  --client-name "finstant-spa-client" \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region us-east-1
```
*(Save the returned `ClientId`, e.g., `1lqralnuo80d5q9ar1krd2o9ct`)*

### 2.4 Create User Groups (RBAC)
```bash
aws cognito-idp create-group --user-pool-id "<YOUR_USER_POOL_ID>" --group-name "SuperAdmin" --precedence 1 --region us-east-1
aws cognito-idp create-group --user-pool-id "<YOUR_USER_POOL_ID>" --group-name "Admin" --precedence 2 --region us-east-1
aws cognito-idp create-group --user-pool-id "<YOUR_USER_POOL_ID>" --group-name "User" --precedence 3 --region us-east-1
```

### 2.5 Create Programmatic IAM User (Bedrock + Cognito)
```bash
# Create IAM user
aws iam create-user --user-name finstant-backend-service

# Attach Cognito permissions
aws iam attach-user-policy \
  --user-name finstant-backend-service \
  --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser

# Attach Bedrock permissions (airtight AI invocation)
aws iam attach-user-policy \
  --user-name finstant-backend-service \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

# Generate access keys
aws iam create-access-key --user-name finstant-backend-service
```
*(Save the output `AccessKeyId` and `SecretAccessKey`)*

### 2.6 Seed Initial SuperAdmin
```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id "<YOUR_USER_POOL_ID>" \
  --username "admin@yourcompany.com" \
  --user-attributes Name=email,Value="admin@yourcompany.com" Name=email_verified,Value=true \
  --region us-east-1

# Add to SuperAdmin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "<YOUR_USER_POOL_ID>" \
  --username "admin@yourcompany.com" \
  --group-name "SuperAdmin" \
  --region us-east-1
```

---

## 3️⃣ Connect to AWS EC2 via Terminal

Ensure your EC2 instance security group allows:
- **Port 22** (SSH from your IP)
- **Port 80** (HTTP)
- **Port 443** (HTTPS)

In **`[LOCAL TERMINAL]`**:

```bash
# Set key permission (Linux / macOS)
chmod 400 finstant-key.pem

# SSH into your EC2 instance
ssh -i "path/to/finstant-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

## 4️⃣ EC2 Server: System Dependencies & PostgreSQL Setup

All commands in this step run inside **`[EC2 TERMINAL]`**:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.11, PostgreSQL, Nginx, Node.js 20
sudo apt install -y git curl wget build-essential libpq-dev postgresql postgresql-contrib nginx python3.11 python3.11-venv python3.11-dev

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Setup PostgreSQL Dual Databases
```bash
# Set password for default postgres user
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'MasterPostgresSecure123!';"

# Create application and knowledge base databases
sudo -u postgres createdb finstant_users
sudo -u postgres createdb finstant_kb

# Create strictly read-only user for AI SQL queries
sudo -u postgres psql -d finstant_kb << 'EOF'
CREATE USER finstant_kb_reader WITH PASSWORD 'kb_reader_secure_123';
GRANT CONNECT ON DATABASE finstant_kb TO finstant_kb_reader;
GRANT USAGE ON SCHEMA public TO finstant_kb_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finstant_kb_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO finstant_kb_reader;
EOF
```

---

## 5️⃣ EC2 Server: Clone & Configure Project

Still inside **`[EC2 TERMINAL]`**:

```bash
# Clone repository directly to EC2
git clone https://github.com/myaseen9/Finstant.git ~/finance-knowledge-engine
cd ~/finance-knowledge-engine

# Apply application users schema
psql -h localhost -U postgres -d finstant_users -f db_schemas/app_schema.sql
# (When prompted, enter: MasterPostgresSecure123!)
```

---

## 6️⃣ EC2 Server: Backend Environment & Setup

In **`[EC2 TERMINAL]`**:

```bash
cd ~/finance-knowledge-engine/backend

# Create virtual environment and install requirements
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r ../requirements.txt

# Create backend .env file
cat << 'EOF' > .env
# Dual Database Connections
DATABASE_URL=postgresql://postgres:MasterPostgresSecure123!@localhost:5432/finstant_users
KB_INGESTION_URL=postgresql://postgres:MasterPostgresSecure123!@localhost:5432/finstant_kb
KB_DATABASE_URL=postgresql://finstant_kb_reader:kb_reader_secure_123@localhost:5432/finstant_kb

# AWS Bedrock Only (Airtight - No direct API keys)
ANTHROPIC_API_KEY=
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-haiku-20241022-v1:0

# AWS Cognito & IAM Credentials
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=<YOUR_USER_POOL_ID>
COGNITO_APP_CLIENT_ID=<YOUR_APP_CLIENT_ID>
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
EOF

# Edit values to insert your actual AWS keys
nano .env
```

---

## 7️⃣ EC2 Server: Frontend Environment & Build

In **`[EC2 TERMINAL]`**:

```bash
cd ~/finance-knowledge-engine/frontend

# Create frontend .env file
cat << 'EOF' > .env
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<YOUR_USER_POOL_ID>
NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=<YOUR_APP_CLIENT_ID>
EOF

# Edit values with your actual User Pool ID and Client ID
nano .env

# Install dependencies and build production app
npm install
npm run build
```

---

## 8️⃣ EC2 Server: Nginx Reverse Proxy Configuration

In **`[EC2 TERMINAL]`**:

```bash
# Create Nginx site configuration
sudo bash -c 'cat << "EOF" > /etc/nginx/sites-available/finstant
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    # API Proxy to FastAPI Backend
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    # Frontend Next.js Proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF'

# Enable site and restart Nginx
sudo ln -sf /etc/nginx/sites-available/finstant /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 9️⃣ EC2 Server: Setup 24/7 Systemd Services

In **`[EC2 TERMINAL]`**:

### 9.1 Backend Service
```bash
sudo bash -c 'cat << "EOF" > /etc/systemd/system/finstant-backend.service
[Unit]
Description=FINSTANT FastAPI AI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/finance-knowledge-engine/backend
EnvironmentFile=/home/ubuntu/finance-knowledge-engine/backend/.env
ExecStart=/home/ubuntu/finance-knowledge-engine/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'
```

### 9.2 Frontend Service
```bash
sudo bash -c 'cat << "EOF" > /etc/systemd/system/finstant-frontend.service
[Unit]
Description=FINSTANT Next.js Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/finance-knowledge-engine/frontend
Environment=NODE_ENV=production
EnvironmentFile=/home/ubuntu/finance-knowledge-engine/frontend/.env
ExecStart=/usr/bin/npm start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'
```

### 9.3 Start & Enable Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable finstant-backend finstant-frontend
sudo systemctl start finstant-backend finstant-frontend

# Verify both are active
sudo systemctl status finstant-backend --no-pager
sudo systemctl status finstant-frontend --no-pager
```

---

## 🔟 Ready to Use

1. Open your browser: `http://<YOUR_EC2_PUBLIC_IP>/login`
2. Log in with your initial SuperAdmin email and temporary password.
3. Set your new permanent password.
4. Upload your Master financial spreadsheet `.xlsx` via the Admin Panel.
5. All AI analytics queries run 100% through **AWS Bedrock** inside your AWS perimeter!

## Useful Operational Commands

Whenever you want to refresh or restart FINSTΛNT on the server, run this in **`[EC2 TERMINAL]`**:

### 🔄 One-Liner Full System Restart (Backend + Frontend + Nginx)
```bash
sudo systemctl restart finstant-backend finstant-frontend nginx
```

### Check System Status
```bash
sudo systemctl status finstant-backend finstant-frontend --no-pager
```

### View Real-Time Live Logs
```bash
# View backend logs (FastAPI / AI engine)
sudo journalctl -u finstant-backend -f

# View frontend logs (Next.js)
sudo journalctl -u finstant-frontend -f
```

---

## Credits
Developed at DPL by WhiteWalkers ❤️
- **Muhammad Yaseen**
- **Muhammad Ahmad**
- **Ramalah Amir**
- **Bilawal Pervaiz**