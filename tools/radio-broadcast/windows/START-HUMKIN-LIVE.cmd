@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0station-one.ps1" -Action StartR2
if errorlevel 1 echo Station One start failed. Check the error above.
echo.
pause
