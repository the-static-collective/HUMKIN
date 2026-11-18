@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0station-one.ps1" -Action StopR2
if errorlevel 1 echo Station One stop request failed. Check the error above.
echo.
pause
