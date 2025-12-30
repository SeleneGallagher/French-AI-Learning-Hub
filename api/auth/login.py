"""
用户登录API - 使用 PostgreSQL
"""
import json
import os
import jwt
import bcrypt
from lib.utils import json_response, get_db_cursor, get_db_connection

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def handler(request):
    # 获取请求方法
    if isinstance(request, dict):
        method = request.get('httpMethod', 'GET')
    else:
        method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
    method = method.upper() if method else 'GET'
    
    # 处理 CORS 预检请求
    if method == 'OPTIONS':
        return json_response({}, 200)
    
    if method != 'POST':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        # 解析请求体
        if isinstance(request, dict):
            body_str = request.get('body', '{}')
            data = json.loads(body_str) if body_str else {}
        elif hasattr(request, 'body'):
            if isinstance(request.body, str):
                data = json.loads(request.body) if request.body else {}
            else:
                data = request.body if request.body else {}
        else:
            data = request.get_json() if hasattr(request, 'get_json') else {}
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return json_response({'success': False, 'message': '请填写用户名和密码'}, 400)
        
        # 查询用户
        cursor = get_db_cursor()
        cursor.execute("""
            SELECT id, username, password_hash 
            FROM users 
            WHERE username = %s AND is_active = TRUE
        """, (username,))
        
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            return json_response({'success': False, 'message': '用户名或密码错误'}, 401)
        
        # 验证密码
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            cursor.close()
            return json_response({'success': False, 'message': '用户名或密码错误'}, 401)
        
        # 更新最后登录时间
        conn = get_db_connection()
        cursor.execute("""
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP 
            WHERE id = %s
        """, (user['id'],))
        conn.commit()
        
        # 生成JWT Token
        token = jwt.encode(
            {'user_id': str(user['id'])},
            JWT_SECRET,
            algorithm='HS256'
        )
        
        cursor.close()
        
        return json_response({
            'success': True,
            'token': token,
            'user': {'id': str(user['id']), 'username': user['username']}
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)
