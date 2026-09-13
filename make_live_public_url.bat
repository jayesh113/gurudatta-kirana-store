@echo off
cd /d "%~dp0"
title Gurudatta Kirana - Instant Public Live URL
color 0B

echo ===================================================================
echo     GURUDATTA KIRANA AND GENERAL STORES - PUBLIC LIVE TUNNEL
echo ===================================================================
echo.
echo This tool makes your Gurudatta Kirana POS system accessible
echo across the ENTIRE INTERNET (on Mobile 4G/5G, anywhere in the world).
echo.
echo Make sure your local server is running (run.bat or start_server.ps1).
echo.
echo Generating public HTTPS link...
echo ===================================================================
echo.

cmd /c "npx -y localtunnel --port 5000"

pause
