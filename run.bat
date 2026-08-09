@echo off
title Finance Knowledge Engine
echo =========================================
echo Starting Finance Knowledge Engine...
echo =========================================
echo.

echo Launching Backend FastAPI Server...
start "Finance Backend" cmd /k "cd backend && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Launching Next.js Development Server...
start "Finance Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers have been launched in separate windows!
echo You can safely close this window.
pause
