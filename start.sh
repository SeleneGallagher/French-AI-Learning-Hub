#!/bin/bash
# Railway 启动脚本
# 读取 PORT 环境变量，如果不存在则使用默认值 5000

PORT=${PORT:-5000}
exec gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
