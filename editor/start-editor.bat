@echo off
cd /d %~dp0\..
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH.
    echo Install Node.js and reopen terminal, then try again.
    pause
    exit /b 1
)

echo Starting Enemy Editor server...
echo URL: http://127.0.0.1:8787
echo Press Ctrl+C to stop.
echo.
node editor\server.js
echo.
echo Server stopped.
pause
