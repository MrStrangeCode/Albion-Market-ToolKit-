@echo off
echo Starting Albion Online Toolkit...
cd /d "%~dp0"
python3 desktop_app.py
if errorlevel 1 (
    echo.
    echo Error: Could not start the app. Make sure Python 3 is installed.
    pause
)
