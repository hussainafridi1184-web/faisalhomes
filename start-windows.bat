@echo off
title FAISAL HOMES - Server (keep this window open)
cd /d "%~dp0"
echo Starting FAISAL HOMES... open http://localhost:4000 in your browser.
echo Other computers/phones in the office: http://THIS-PC-IP:4000
start "" http://localhost:4000
node server\src\index.js
echo The server stopped. Press a key to close.
pause >nul
