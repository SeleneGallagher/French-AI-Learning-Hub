@echo off
chcp 65001 >nul
title French AI Learning Hub
color 0A
echo.
echo ========================================
echo   French AI Learning Hub - Starting...
echo ========================================
echo.

REM 切换到脚本所在目录（项目根目录）
cd /d "%~dp0"
echo [INFO] Working directory: %CD%
echo.

REM 检查 index.html 是否存在
if not exist "index.html" (
    echo [ERROR] Cannot find index.html in current directory.
    echo [ERROR] Please make sure you run this script from the project root directory.
    echo.
    echo Current directory: %CD%
    echo.
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not detected. Please install Python 3.x first.
    echo.
    echo Download: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

REM Check if port 8000 is in use
netstat -an | find "8000" | find "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port 8000 is already in use.
    echo [INFO] Trying to use port 8000 anyway...
    echo [INFO] If it fails, please close the application using port 8000
    echo.
)

echo [INFO] Starting local server...
echo [INFO] Server address: http://localhost:8000
echo [INFO] Browser will open automatically...
echo [INFO] Close this window to stop the server
echo.
echo ========================================
echo.

REM Wait 2 seconds before opening browser to ensure server is ready
timeout /t 2 /nobreak >nul
start http://localhost:8000

REM Start Python HTTP server (in current directory)
echo [INFO] Server is running. Press Ctrl+C to stop.
echo.
python -m http.server 8000

REM If server exits, show error message
if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start. Possible reasons:
    echo   1. Port 8000 is already in use
    echo   2. Python is not installed correctly
    echo   3. Firewall is blocking the connection
    echo.
    pause
)

