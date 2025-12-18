#!/bin/bash

# French AI Learning Hub - Mac启动脚本

echo ""
echo "========================================"
echo "  French AI Learning Hub - Starting..."
echo "========================================"
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python not detected. Please install Python 3.x first."
    echo ""
    echo "Install via Homebrew: brew install python3"
    echo "Or download: https://www.python.org/downloads/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# 确定 Python 命令
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 检查项目根目录（包含index.html的目录）
if [ -f "$SCRIPT_DIR/index.html" ]; then
    PROJECT_DIR="$SCRIPT_DIR"
    echo "[INFO] Found project directory: $PROJECT_DIR"
else
    echo "[ERROR] Cannot find index.html in script directory."
    echo "[ERROR] Please make sure you run this script from the project root directory."
    echo ""
    echo "Current directory: $SCRIPT_DIR"
    echo "Expected file: $SCRIPT_DIR/index.html"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# 切换到项目目录
cd "$PROJECT_DIR"
echo "[INFO] Working directory: $(pwd)"
echo ""

# 检查端口 8000 是否被占用
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "[WARNING] Port 8000 is already in use."
    echo "[INFO] Trying to use port 8000 anyway..."
    echo "[INFO] If it fails, please close the application using port 8000"
    echo ""
fi

echo "[INFO] Starting local server..."
echo "[INFO] Server address: http://localhost:8000"
echo "[INFO] Browser will open automatically..."
echo "[INFO] Press Ctrl+C to stop the server"
echo ""
echo "========================================"
echo ""

# 等待1秒后打开浏览器
sleep 1
open http://localhost:8000

# 启动 Python HTTP 服务器（在项目目录）
$PYTHON_CMD -m http.server 8000

