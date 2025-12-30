"""
API工具函数
"""
import os
import json
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

# PostgreSQL 连接池（简单实现）
_db_connection = None

def get_db_connection():
    """获取 PostgreSQL 数据库连接"""
    global _db_connection
    
    if _db_connection and not _db_connection.closed:
        return _db_connection
    
    # 从环境变量获取数据库 URL
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        raise ValueError('DATABASE_URL 环境变量未设置。请在 Railway Dashboard 中配置数据库连接。')
    
    try:
        # Railway PostgreSQL URL 格式可能是 postgres:// 或 postgresql://
        # 统一转换为 postgresql://
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        # 解析数据库 URL
        parsed = urlparse(database_url)
        
        # 如果 hostname 是内部网络地址，尝试使用外部连接
        # Railway 内部网络地址格式：postgres.railway.internal
        hostname = parsed.hostname
        if hostname and 'railway.internal' in hostname:
            # 尝试从环境变量获取外部连接 URL
            external_url = os.environ.get('DATABASE_EXTERNAL_URL') or os.environ.get('RAILWAY_DATABASE_URL')
            if external_url:
                if external_url.startswith('postgres://'):
                    external_url = external_url.replace('postgres://', 'postgresql://', 1)
                parsed = urlparse(external_url)
                hostname = parsed.hostname
        
        # 建立连接
        _db_connection = psycopg2.connect(
            host=hostname,
            port=parsed.port or 5432,
            database=parsed.path[1:] if parsed.path else '',  # 移除前导斜杠
            user=parsed.username,
            password=parsed.password,
            sslmode='require'  # Railway PostgreSQL 需要 SSL
        )
        
        return _db_connection
    except Exception as e:
        raise ValueError(f'无法连接到数据库: {str(e)}')

def get_db_cursor():
    """获取数据库游标（返回字典格式）"""
    conn = get_db_connection()
    return conn.cursor(cursor_factory=RealDictCursor)

def verify_token(request):
    """验证JWT Token并返回user_id"""
    # 处理Vercel格式的request对象
    if isinstance(request, dict):
        headers = request.get('headers', {})
        # Vercel headers可能是小写的
        auth_header = headers.get('Authorization', '') or headers.get('authorization', '')
    elif hasattr(request, 'headers'):
        if isinstance(request.headers, dict):
            auth_header = request.headers.get('Authorization', '') or request.headers.get('authorization', '')
        else:
            # Flask格式
            auth_header = request.headers.get('Authorization', '')
    else:
        auth_header = ''
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.replace('Bearer ', '')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except:
        return None

def json_response(data, status_code=200):
    """返回JSON响应"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps(data, ensure_ascii=False)
    }


