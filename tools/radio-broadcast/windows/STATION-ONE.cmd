@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0station-one.ps1" -Action Menu
if errorlevel 1 echo.
if errorlevel 1 echo Station One stopped with an error. See the message above.
echo.
pause
