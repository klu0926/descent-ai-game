@echo off
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8787 ^| findstr LISTENING') do (
    set FOUND=1
    taskkill /PID %%a /F
)
if "%FOUND%"=="0" (
    echo No process is listening on port 8787.
)
