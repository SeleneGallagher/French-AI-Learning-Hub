#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库初始化脚本
使用 Python 直接连接 Railway PostgreSQL 并执行初始化 SQL
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse

# 修复 Windows 控制台编码问题
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def init_database():
    """初始化数据库"""
    
    # 获取数据库连接 URL
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("❌ 错误：未找到 DATABASE_URL 环境变量")
        print("\n请按以下步骤操作：")
        print("1. 在 Railway Dashboard 中，点击 PostgreSQL 服务")
        print("2. 点击 'Connect' 按钮")
        print("3. 复制连接字符串（类似：postgresql://user:pass@host:port/db）")
        print("4. 在 PowerShell 中设置环境变量：")
        print("   $env:DATABASE_URL='你的连接字符串'")
        print("5. 然后重新运行此脚本")
        return False
    
    try:
        # 解析数据库 URL
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        parsed = urlparse(database_url)
        
        print("🔗 正在连接数据库...")
        print(f"   主机: {parsed.hostname}")
        print(f"   端口: {parsed.port or 5432}")
        print(f"   数据库: {parsed.path[1:]}")
        
        # 建立连接
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            database=parsed.path[1:],  # 移除前导斜杠
            user=parsed.username,
            password=parsed.password,
            sslmode='require'  # Railway PostgreSQL 需要 SSL
        )
        
        print("✅ 数据库连接成功！")
        
        # 读取 SQL 文件
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sql_file = os.path.join(script_dir, 'init.sql')
        
        if not os.path.exists(sql_file):
            print(f"❌ 错误：找不到 SQL 文件: {sql_file}")
            return False
        
        print(f"\n📄 读取 SQL 文件: {sql_file}")
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # 执行 SQL
        print("\n🚀 开始执行 SQL 初始化脚本...")
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        cursor.close()
        
        print("✅ 数据库初始化成功！")
        
        # 验证表是否创建成功
        print("\n🔍 验证表结构...")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        cursor.close()
        
        expected_tables = [
            'users', 'registration_codes', 'dict_history', 
            'dict_favorites', 'vocab_progress', 'expressions',
            'expression_favorites', 'ai_chat_history', 'movie_watchlist'
        ]
        
        created_tables = [t[0] for t in tables]
        print(f"\n📊 已创建 {len(created_tables)} 个表：")
        for table in created_tables:
            status = "✅" if table in expected_tables else "⚠️"
            print(f"   {status} {table}")
        
        # 验证注册码
        print("\n🔍 验证注册码...")
        cursor = conn.cursor()
        cursor.execute("SELECT code, unlimited_use, is_active FROM registration_codes;")
        codes = cursor.fetchall()
        cursor.close()
        
        if codes:
            print("✅ 注册码已创建：")
            for code, unlimited, active in codes:
                print(f"   代码: {code}, 永久使用: {unlimited}, 激活: {active}")
        else:
            print("⚠️  警告：未找到注册码")
        
        conn.close()
        print("\n🎉 数据库初始化完成！")
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ 数据库错误: {e}")
        return False
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("  Railway PostgreSQL 数据库初始化工具")
    print("=" * 60)
    print()
    
    success = init_database()
    
    if not success:
        print("\n💡 提示：")
        print("   如果遇到连接问题，请检查：")
        print("   1. DATABASE_URL 环境变量是否正确设置")
        print("   2. Railway PostgreSQL 服务是否在线")
        print("   3. 网络连接是否正常")
        sys.exit(1)
    else:
        sys.exit(0)

