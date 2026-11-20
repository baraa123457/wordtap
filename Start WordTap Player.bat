@echo off
title WordTap VLC Player
cd /d "%~dp0"

if exist "desktop-player\dist\WordTap-VLC-Player-win32-x64\WordTap-VLC-Player.exe" (
    echo [WordTap] Launching WordTap VLC Player (.exe)...
    start "" "desktop-player\dist\WordTap-VLC-Player-win32-x64\WordTap-VLC-Player.exe"
    exit
)

cd desktop-player
if not exist ".\node_modules\electron\dist\electron.exe" (
    echo [WordTap] Electron not found, installing dependencies...
    npm install
)
echo [WordTap] Launching WordTap VLC Player...
start "" ".\node_modules\electron\dist\electron.exe" .
exit
