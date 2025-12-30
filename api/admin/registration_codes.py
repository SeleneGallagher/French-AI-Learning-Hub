"""
管理员API - 注册码管理
"""
import json
import os
from lib.utils import json_response, get_db_cursor, get_db_connection


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
    
    # 验证管理员密码
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if isinstance(request, dict):
        headers = request.get('headers', {})
    else:
        headers = getattr(request, 'headers', {})
    headers_lower = {k.lower(): v for k, v in headers.items()}
    provided_password = headers_lower.get('x-admin-password', '')
    
    if not admin_password:
        return json_response({'success': False, 'message': '管理员功能未配置'}, 403)
    
    if provided_password != admin_password:
        return json_response({'success': False, 'message': '管理员密码错误'}, 401)
    
    # 根据方法分发处理
    if method == 'GET':
        return handle_get_codes()
    elif method == 'POST':
        return handle_create_code(request)
    elif method == 'DELETE':
        return handle_delete_code(request)
    elif method == 'PUT':
        return handle_update_code(request)
    else:
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)


def handle_get_codes():
    """获取所有注册码"""
    try:
        cursor = get_db_cursor()
        cursor.execute("""
            SELECT 
                rc.id,
                rc.code,
                rc.is_active,
                rc.unlimited_use,
                rc.used_at,
                rc.used_by_user_id,
                u.username as used_by_username
            FROM registration_codes rc
            LEFT JOIN users u ON rc.used_by_user_id = u.id
            ORDER BY rc.code ASC
        """)
        
        codes = cursor.fetchall()
        cursor.close()
        
        # 转换数据格式
        codes_list = []
        for code in codes:
            codes_list.append({
                'id': str(code['id']),
                'code': code['code'],
                'is_active': code['is_active'],
                'unlimited_use': code['unlimited_use'],
                'used_at': code['used_at'].isoformat() if code['used_at'] else None,
                'used_by_user_id': str(code['used_by_user_id']) if code['used_by_user_id'] else None,
                'used_by_username': code['used_by_username'] if code['used_by_username'] else None,
                'status': 'used' if code['used_at'] and not code['unlimited_use'] else ('active' if code['is_active'] else 'inactive')
            })
        
        return json_response({
            'success': True,
            'count': len(codes_list),
            'codes': codes_list
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)


def handle_create_code(request):
    """创建新注册码"""
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
        
        code = data.get('code', '').strip()
        unlimited_use = data.get('unlimited_use', False)
        is_active = data.get('is_active', True)
        
        if not code:
            return json_response({'success': False, 'message': '注册码不能为空'}, 400)
        
        cursor = get_db_cursor()
        conn = get_db_connection()
        
        # 检查注册码是否已存在
        cursor.execute("SELECT id FROM registration_codes WHERE code = %s", (code,))
        if cursor.fetchone():
            cursor.close()
            return json_response({'success': False, 'message': '注册码已存在'}, 400)
        
        # 创建注册码
        cursor.execute("""
            INSERT INTO registration_codes (code, unlimited_use, is_active)
            VALUES (%s, %s, %s)
            RETURNING id, code, unlimited_use, is_active
        """, (code, unlimited_use, is_active))
        
        new_code = cursor.fetchone()
        conn.commit()
        cursor.close()
        
        return json_response({
            'success': True,
            'code': {
                'id': str(new_code['id']),
                'code': new_code['code'],
                'unlimited_use': new_code['unlimited_use'],
                'is_active': new_code['is_active']
            }
        })
        
    except Exception as e:
        conn = get_db_connection()
        conn.rollback()
        return json_response({'success': False, 'message': str(e)}, 500)


def handle_delete_code(request):
    """删除注册码"""
    try:
        # 从URL参数或请求体获取ID
        code_id = None
        if isinstance(request, dict):
            # 从查询参数获取（Flask会将其放在args中，但这里需要从原始请求获取）
            # 尝试从多个可能的位置获取
            if 'queryStringParameters' in request and request['queryStringParameters']:
                code_id = request['queryStringParameters'].get('id')
            if not code_id:
                code_id = request.get('code_id') or request.get('id')
        else:
            # Flask request对象
            code_id = request.args.get('id')
            if not code_id:
                try:
                    json_data = request.get_json(silent=True) or {}
                    code_id = json_data.get('id')
                except:
                    pass
        
        if not code_id:
            return json_response({'success': False, 'message': '注册码ID不能为空'}, 400)
        
        cursor = get_db_cursor()
        conn = get_db_connection()
        
        # 检查注册码是否存在
        cursor.execute("SELECT id FROM registration_codes WHERE id = %s", (code_id,))
        if not cursor.fetchone():
            cursor.close()
            return json_response({'success': False, 'message': '注册码不存在'}, 404)
        
        # 删除注册码
        cursor.execute("DELETE FROM registration_codes WHERE id = %s", (code_id,))
        conn.commit()
        cursor.close()
        
        return json_response({'success': True, 'message': '注册码已删除'})
        
    except Exception as e:
        conn = get_db_connection()
        conn.rollback()
        return json_response({'success': False, 'message': str(e)}, 500)


def handle_update_code(request):
    """更新注册码（激活/禁用）"""
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
        
        code_id = data.get('id')
        is_active = data.get('is_active')
        
        if not code_id:
            return json_response({'success': False, 'message': '注册码ID不能为空'}, 400)
        
        if is_active is None:
            return json_response({'success': False, 'message': 'is_active参数不能为空'}, 400)
        
        cursor = get_db_cursor()
        conn = get_db_connection()
        
        # 更新注册码状态
        cursor.execute("""
            UPDATE registration_codes
            SET is_active = %s
            WHERE id = %s
            RETURNING id, code, is_active
        """, (is_active, code_id))
        
        updated_code = cursor.fetchone()
        if not updated_code:
            cursor.close()
            return json_response({'success': False, 'message': '注册码不存在'}, 404)
        
        conn.commit()
        cursor.close()
        
        return json_response({
            'success': True,
            'code': {
                'id': str(updated_code['id']),
                'code': updated_code['code'],
                'is_active': updated_code['is_active']
            }
        })
        
    except Exception as e:
        conn = get_db_connection()
        conn.rollback()
        return json_response({'success': False, 'message': str(e)}, 500)

