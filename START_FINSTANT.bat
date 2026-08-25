@echo off
title Finstant

echo Starting Backend API...
start "Finstant Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

echo Starting Frontend UI...
start "Finstant Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Opening browser in 4 seconds...
timeout /t 4 /nobreak >nul
start http://localhost:3000
