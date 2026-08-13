@echo off
title RecruitEASE Starter
echo ===================================================
echo             Starting RecruitEASE Server            
echo ===================================================
echo.
echo [1/3] Checking Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/ to run RecruitEASE.
    pause
    exit /b 1
)

echo [2/3] Opening browser...
start http://localhost:8000
start http://localhost:8000/nova/

echo [3/3] Launching Nova (React App) in a new window...
start cmd /k "cd "Nova - Copy\test-app" && npm run dev"

echo [4/4] Launching RecruitEASE local server...
echo.
node server.js

pause
