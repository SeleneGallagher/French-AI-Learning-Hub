"""
API工具函数
"""
import os
import json
import jwt
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')  # 使用service_role key
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def get_supabase():
    """获取Supabase客户端"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError('Supabase配置缺失，请设置环境变量')
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def verify_token(request):
    """验证JWT Token并返回user_id"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
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
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(data, ensure_ascii=False)
    }


