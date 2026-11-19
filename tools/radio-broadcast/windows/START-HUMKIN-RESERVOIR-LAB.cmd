@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo HUMKIN RESERVOIR LAB - 8-minute delayed TEST feed, hot public unchanged.
echo.
echo Existing Station One must be stopped first. This starts ONE encoder
echo and publishes /hls/delayed.m3u8 alongside existing /hls/live.m3u8.
echo Windows automatic idle sleep is prevented while broadcasting.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0station-one.ps1" -Action StartR2 -ReservoirSeconds 480
if errorlevel 1 echo Reservoir lab start failed. Check the error above.
echo.
pause
