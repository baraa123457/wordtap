@echo off
title Install WordTap VLC Lua Extension
cls

echo ========================================================
echo     Installing WordTap Lua Extension into VLC
echo ========================================================
echo.

set "DEST=%APPDATA%\vlc\lua\extensions"
if not exist "%DEST%" (
    echo [INFO] Creating directory: %DEST%
    mkdir "%DEST%"
)

copy /Y "%~dp0wordtap.lua" "%DEST%\wordtap.lua" >nul

if "%ERRORLEVEL%"=="0" (
    echo [SUCCESS] WordTap VLC extension successfully installed!
    echo.
    echo In VLC, you can now access it under:
    echo   View -^> WordTap Subtitle Assistant
    echo.
) else (
    echo [ERROR] Failed to copy extension file to %DEST%.
)

pause
