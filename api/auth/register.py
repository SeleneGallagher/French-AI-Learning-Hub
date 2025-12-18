"""
用户注册API
"""
import json
import os
import jwt
import bcrypt
from api.utils import get_supabase, json_response

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def handler(request):
    if request.method != 'POST':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        reg_code = data.get('registration_code', '').strip()
        
        if not username or not password or not reg_code:
            return json_response({'success': False, 'message': '请填写所有字段'}, 400)
        
        supabase = get_supabase()
        
        # 验证注册码
        code_result = supabase.table('registration_codes')\
            .select('*')\
            .eq('code', reg_code)\
            .eq('is_active', True)\
            .execute()
        
        if not code_result.data:
            return json_response({'success': False, 'message': '注册码无效'}, 400)
        
        registration_code = code_result.data[0]
        
        # 检查注册码是否可用
        # 如果是无限使用的注册码，跳过used_at检查
        if not registration_code.get('unlimited_use', False):
            # 单次使用的注册码，检查是否已使用
            if registration_code.get('used_at'):
                return json_response({'success': False, 'message': '注册码已使用'}, 400)
        
        # 检查用户名是否存在
        user_result = supabase.table('users')\
            .select('id')\
            .eq('username', username)\
            .execute()
        
        if user_result.data:
            return json_response({'success': False, 'message': '用户名已存在'}, 400)
        
        # 创建用户
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user_result = supabase.table('users')\
            .insert({
                'username': username,
                'password_hash': password_hash
            })\
            .execute()
        
        user = user_result.data[0]
        
        # 标记注册码为已使用（仅限单次使用的注册码）
        if not registration_code.get('unlimited_use', False):
            supabase.table('registration_codes')\
                .update({
                    'used_at': 'now()',
                    'used_by_user_id': user['id']
                })\
                .eq('code', reg_code)\
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


