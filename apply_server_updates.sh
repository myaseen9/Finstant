#!/bin/bash
# ==============================================================================
# FINSTANT EC2 UPDATE & BUILD SCRIPT
# Run this on your EC2 Ubuntu terminal: ubuntu@54.83.65.189
# ==============================================================================
set -e

echo ">>> Updating Finstant on AWS EC2..."
cd /home/ubuntu/finance-knowledge-engine/frontend

echo ">>> Building Next.js frontend..."
npm run build

echo ">>> Restarting PM2 services..."
pm2 restart finstant-backend --update-env
pm2 restart finstant-frontend

echo ">>> Verifying service status..."
pm2 status

echo ">>> All updates successfully applied!"
