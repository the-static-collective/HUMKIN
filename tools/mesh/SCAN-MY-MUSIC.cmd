@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
echo.
echo  HUMKIN MESH - LOCAL MUSIC INVENTORY
echo  Reads your chosen folder; it never moves, uploads or deletes audio.
echo.
set "ROOT="
set /p "ROOT=Music folder path (paste from File Explorer): "
if not defined ROOT goto :missing
if not exist "%ROOT%\" goto :missing
echo.
echo  Examples: artist/album  album/artist  genre/artist/album  none
set "LAYOUT="
set /p "LAYOUT=Folder layout [artist/album]: "
if not defined LAYOUT set "LAYOUT=artist/album"
set "PROBE="
set /p "PROBE=Read embedded tags/durations with ffprobe? Slower (y/N): "
set "OUTPUT=%USERPROFILE%\Downloads\humkin-mesh-inventory.json"
if /i "%PROBE%"=="y" (
  py -3 "%~dp0scan.py" --root "%ROOT%" --layout "%LAYOUT%" --out "%OUTPUT%" --probe
) else (
  py -3 "%~dp0scan.py" --root "%ROOT%" --layout "%LAYOUT%" --out "%OUTPUT%"
)
if errorlevel 1 (
  echo Scan failed. Check the path and Python installation.
) else (
  echo.
  echo Open https://humkin.abundent.org/fm/mesh/ and select the manifest:
  echo %OUTPUT%
  echo.
  echo Audio stays on this computer. Only metadata is imported after approval.
)
echo.
pause
exit /b
:missing
echo No readable folder selected. Nothing changed.
pause
exit /b 1
