@echo off
title WordTap VLC Companion Launcher
cls

echo ========================================================
echo         WordTap VLC Interactive Subtitles Launcher
echo ========================================================
echo.

REM 1. Look for VLC installation
set "VLC_PATH="
if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" set "VLC_PATH=C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"
if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" set "VLC_PATH=C:\Program Files\VideoLAN\VLC\vlc.exe"

REM 2. Check if VLC is running
tasklist /FI "IMAGENAME eq vlc.exe" 2>NUL | find /I /N "vlc.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] VLC is already running.
) else (
    if defined VLC_PATH (
        echo [INFO] Starting VLC with WordTap Subtitle HTTP API...
        start "" "%VLC_PATH%" --extraintf http --http-password wordtap --http-port 8080
    ) else (
        echo [WARN] Could not auto-detect vlc.exe path.
        echo Please ensure VLC is running with Web interface enabled.
    )
)

echo [INFO] Starting WordTap Floating Subtitle Overlay...
cd /d "%~dp0"
python wordtap_vlc.py

pause
