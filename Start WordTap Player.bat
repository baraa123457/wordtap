@echo off
title WordTap Desktop Video Player
cd /d "%~dp0desktop-player"
if not exist ".\node_modules\electron\dist\electron.exe" (
    echo [WordTap] Electron not found, installing dependencies...
    npm install
)
echo [WordTap] Launching WordTap Desktop Player...
start "" ".\node_modules\electron\dist\electron.exe" .
exit
