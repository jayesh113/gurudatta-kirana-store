@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Gurudatta Kirana and General Stores - POS Management System
color 0A

echo ===================================================================
echo     GURUDATTA KIRANA AND GENERAL STORES - SHOP MANAGEMENT SYSTEM
echo ===================================================================
echo.

:: Detect Python command (python or py)
set PYTHON_CMD=python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py
    ) else (
        color 0C
        echo [ERROR] Python was not detected on this computer!
        echo.
        echo Please download and install Python from:
        echo https://www.python.org/downloads/
        echo (Make sure to check "Add python.exe to PATH" during installation)
        echo.
        pause
        exit /b 1
    )
)

echo [1/3] Verifying store database...
%PYTHON_CMD% database.py
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to initialize database!
    pause
    exit /b 1
)

echo [2/3] Detecting network address for Mobile access...
echo.
%PYTHON_CMD% -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print('   >>> YOUR MOBILE ADDRESS: http://' + s.getsockname()[0] + ':5000'); s.close()" 2>nul
echo    >>> YOUR LAPTOP ADDRESS: http://127.0.0.1:5000
echo.
echo ===================================================================
echo  NOTE FOR MOBILE PHONE USE:
echo  1. Connect your phone to the same Wi-Fi as this laptop.
echo  2. Open Chrome/Safari on your phone and type the MOBILE ADDRESS above!
echo  3. LEAVE THIS WINDOW OPEN while using the software.
echo ===================================================================
echo.

:: Wait 2 seconds and launch default browser to local address
echo [3/3] Opening software in your web browser...
start /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:5000"

:: Start the Flask application
%PYTHON_CMD% app.py

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] The server stopped unexpectedly.
    pause
)
