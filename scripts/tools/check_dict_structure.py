#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时脚本：查看公共法语学习词典.txt的结构"""

import os
import sys
from pathlib import Path

# 设置输出编码为UTF-8
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parents[2]
TXT_FILE = BASE_DIR / '公共法语学习词典.txt'

print(f"检查文件: {TXT_FILE}")
print(f"文件存在: {TXT_FILE.exists()}")
if TXT_FILE.exists():
    print(f"文件大小: {TXT_FILE.stat().st_size / 1024 / 1024:.2f} MB")
    print("\n前200行内容:")
    print("=" * 80)
    with open(TXT_FILE, 'r', encoding='utf-8') as f:
        lines = []
        for i, line in enumerate(f):
            if i >= 200:
                break
            lines.append(line.rstrip())
    
    for i, line in enumerate(lines, 1):
        print(f"{i:4d}: {line}")
    print("=" * 80)
    
    # 分析结构
    print("\n结构分析:")
    print("-" * 80)
    entry_count = 0
    entry_patterns = []
    with open(TXT_FILE, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= 500:  # 分析前500行
                break
            line = line.strip()
            if line.startswith('<') and line.endswith('>'):
                entry_count += 1
                if entry_count <= 5:
                    entry_patterns.append((i+1, line))
            elif line.startswith('>'):
                if entry_count <= 5:
                    entry_patterns.append((i+1, line[:100]))  # 只取前100字符
    
    print(f"前500行中发现 {entry_count} 个词条标记")
    print("\n前5个词条示例:")
    for line_num, content in entry_patterns[:10]:
        print(f"  行{line_num}: {content}")

