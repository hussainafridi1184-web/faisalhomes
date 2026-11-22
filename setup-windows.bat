@echo off
title FAISAL HOMES - Setup
cd /d "%~dp0"
echo ============================================
echo   FAISAL HOMES - first time setup
echo ============================================
where node >nul 2>nul || (echo Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo A settings file .env was created. Open it in Notepad, set your PostgreSQL password, save, then run this file again.
  notepad ".env"
  pause
  exit /b 0
)
echo Installing server components...
call npm install --prefix server --omit=dev || (echo Install failed. & pause & exit /b 1)
echo Creating / updating the database...
call npm run migrate --prefix server || (echo Database setup failed. Check DATABASE_URL in .env and that PostgreSQL is running. & pause & exit /b 1)
echo.
echo Setup complete. Double-click start-windows.bat to run FAISAL HOMES.
pause
