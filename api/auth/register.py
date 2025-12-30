"""
用户注册API - 使用 PostgreSQL
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
        reg_code = data.get('registration_code', '').strip()
        
        if not username or not password or not reg_code:
            return json_response({'success': False, 'message': '请填写所有字段'}, 400)
        
        cursor = get_db_cursor()
        conn = get_db_connection()
        
        # 验证注册码
        cursor.execute("""
            SELECT id, unlimited_use, used_at 
            FROM registration_codes 
            WHERE code = %s AND is_active = TRUE
        """, (reg_code,))
        
        code_record = cursor.fetchone()
        
        if not code_record:
            cursor.close()
            return json_response({'success': False, 'message': '注册码无效'}, 400)
        
        # 检查注册码是否已使用（仅限单次使用的注册码）
        if not code_record['unlimited_use'] and code_record['used_at']:
            cursor.close()
            return json_response({'success': False, 'message': '注册码已使用'}, 400)
        
        # 检查用户名是否存在
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close()
            return json_response({'success': False, 'message': '用户名已存在'}, 400)
        
        # 创建用户
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute("""
            INSERT INTO users (username, password_hash) 
            VALUES (%s, %s) 
            RETURNING id, username
        """, (username, password_hash))
        
        user = cursor.fetchone()
        
        # 标记注册码为已使用（仅限单次使用的注册码）
        if not code_record['unlimited_use']:
            cursor.execute("""
                UPDATE registration_codes 
                SET used_at = CURRENT_TIMESTAMP, used_by_user_id = %s 
                WHERE id = %s
            """, (user['id'], code_record['id']))
        
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
        conn = get_db_connection()
        conn.rollback()
        return json_response({'success': False, 'message': str(e)}, 500)
