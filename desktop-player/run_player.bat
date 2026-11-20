@echo off
title WordTap VLC Player
cd /d "%~dp0"
if not exist ".\node_modules\electron\dist\electron.exe" (
    echo [WordTap] Electron not found, installing dependencies...
    npm install
)
echo [WordTap] Launching WordTap VLC Player...
start "" ".\node_modules\electron\dist\electron.exe" .
exit
