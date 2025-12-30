#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Railway 启动脚本
读取 PORT 环境变量并启动 Gunicorn
"""
import os
import sys

# 获取端口，如果不存在则使用默认值 5000
port = os.environ.get('PORT', '5000')

# 启动 Gunicorn
os.execvp('gunicorn', [
    'gunicorn',
    'app:app',
    '--bind', f'0.0.0.0:{port}',
    '--workers', '2',
    '--timeout', '120'
])

