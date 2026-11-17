@echo off
title LinkedIn AI Post Assistant Launcher
echo ===================================================
echo   Starting LinkedIn AI Post Assistant Services
echo ===================================================
echo.

echo [1/2] Starting Backend Server (FastAPI on http://localhost:8000)...
start "Backend - FastAPI" cmd /k "cd /d "%~dp0backend_custom_topic" && .venv\Scripts\activate && python api.py"

echo [2/2] Starting Frontend App (Vite on http://localhost:5173)...
start "Frontend - Vite React" cmd /k "cd /d "%~dp0frontend2" && npm run dev"

echo.
echo ===================================================
echo   Both services are starting in separate windows!
echo   - Web Dashboard:     http://localhost:5173
echo   - Backend Docs:      http://localhost:8000/docs
echo ===================================================
echo You can keep this window or close it.
timeout /t 5
