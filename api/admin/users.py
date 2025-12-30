"""
管理员API - 获取所有用户信息
"""
import json
import os
from lib.utils import json_response, get_db_cursor


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
    
    if method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        # 获取管理员密码（从环境变量或请求头）
        admin_password = os.environ.get('ADMIN_PASSWORD', '')
        
        # 从请求头获取管理员密码
        if isinstance(request, dict):
            headers = request.get('headers', {})
        else:
            headers = getattr(request, 'headers', {})
        
        # 处理大小写不敏感的headers
        headers_lower = {k.lower(): v for k, v in headers.items()}
        provided_password = headers_lower.get('x-admin-password', '')
        
        # 验证管理员密码
        if not admin_password:
            return json_response({'success': False, 'message': '管理员功能未配置'}, 403)
        
        if provided_password != admin_password:
            return json_response({'success': False, 'message': '管理员密码错误'}, 401)
        
        # 获取所有用户信息
        cursor = get_db_cursor()
        cursor.execute("""
            SELECT 
                id,
                username,
                is_active,
                created_at,
                last_login
            FROM users
            ORDER BY created_at DESC
        """)
        
        users = cursor.fetchall()
        cursor.close()
        
        # 转换UUID为字符串，处理时间格式
        users_list = []
        for user in users:
            users_list.append({
                'id': str(user['id']),
                'username': user['username'],
                'is_active': user['is_active'],
                'created_at': user['created_at'].isoformat() if user['created_at'] else None,
                'last_login': user['last_login'].isoformat() if user['last_login'] else None
            })
        
        return json_response({
            'success': True,
            'count': len(users_list),
            'users': users_list
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)

