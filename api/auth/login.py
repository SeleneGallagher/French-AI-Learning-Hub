"""
用户登录API
"""
import json
import os
import jwt
import bcrypt
from api.utils import get_supabase, json_response

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def handler(request):
    # 处理 CORS 预检请求
    if request.method == 'OPTIONS':
        return json_response({}, 200)
    
    if request.method != 'POST':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return json_response({'success': False, 'message': '请填写用户名和密码'}, 400)
        
        supabase = get_supabase()
        
        # 查询用户
        user_result = supabase.table('users')\
            .select('*')\
            .eq('username', username)\
            .eq('is_active', True)\
            .execute()
        
        if not user_result.data:
            return json_response({'success': False, 'message': '用户名或密码错误'}, 401)
        
        user = user_result.data[0]
        
        # 验证密码
        if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
            return json_response({'success': False, 'message': '用户名或密码错误'}, 401)
        
        # 更新最后登录时间
        supabase.table('users')\
            .update({'last_login': 'now()'})\
            .eq('id', user['id'])\
            .execute()
        
        # 生成JWT Token
        token = jwt.encode(
            {'user_id': str(user['id'])},
            JWT_SECRET,
            algorithm='HS256'
        )
        
        return json_response({
            'success': True,
            'token': token,
            'user': {'id': str(user['id']), 'username': user['username']}
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)


