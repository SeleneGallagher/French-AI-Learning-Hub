"""
用户数据同步API - 获取用户的AI聊天记录和收藏夹
"""
import os
import json
import jwt
from lib.utils import get_db_connection, verify_jwt

def handler(request):
    if request.method == 'GET':
        return handle_get_sync(request)
    elif request.method == 'POST':
        return handle_post_sync(request)
    else:
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': 'Method not allowed'
            })
        }

def handle_get_sync(request):
    
    # 验证JWT token
    user_id = verify_user(request)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': '未授权，请先登录'
            })
        }
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 获取AI聊天记录（按时间顺序）
        cursor.execute("""
            SELECT role, content, created_at
            FROM ai_chat_history
            WHERE user_id = %s
            ORDER BY created_at ASC
            LIMIT 100
        """, (user_id,))
        chat_records = []
        for row in cursor.fetchall():
            chat_records.append({
                'role': row[0],
                'content': row[1],
                'created_at': row[2].isoformat() if row[2] else None
            })
        
        # 获取语用收藏夹
        cursor.execute("""
            SELECT expression_data, favorited_at
            FROM expression_favorites
            WHERE user_id = %s
            ORDER BY favorited_at DESC
        """, (user_id,))
        expression_favorites = []
        for row in cursor.fetchall():
            expr_data = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if row[0] else {}
            expression_favorites.append({
                'expression_data': expr_data,
                'favorited_at': row[1].isoformat() if row[1] else None
            })
        
        # 获取词典收藏夹
        cursor.execute("""
            SELECT word, phonetic, pos, added_at
            FROM dict_favorites
            WHERE user_id = %s
            ORDER BY added_at DESC
        """, (user_id,))
        dict_favorites = []
        for row in cursor.fetchall():
            dict_favorites.append({
                'word': row[0],
                'phonetic': row[1],
                'pos': row[2] if isinstance(row[2], dict) else json.loads(row[2]) if row[2] else {},
                'added_at': row[3].isoformat() if row[3] else None
            })
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'data': {
                    'chat_history': chat_records,
                    'expression_favorites': expression_favorites,
                    'dict_favorites': dict_favorites
                }
            })
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': f'服务器错误: {str(e)}'
            })
        }

def handle_post_sync(request):
    """处理数据上传（从本地到数据库）"""
    # 验证JWT token
    user_id = verify_user(request)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': '未授权，请先登录'
            })
        }
    
    try:
        # 解析请求体
        body = request.json if hasattr(request, 'json') and request.json else {}
        if not body:
            try:
                body = json.loads(request.body) if hasattr(request, 'body') and request.body else {}
            except:
                body = {}
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 上传AI聊天记录
        if 'chat_history' in body and isinstance(body['chat_history'], list):
            chat_messages = body['chat_history']
            # 先删除用户的所有旧记录（简单策略：全量替换）
            cursor.execute("DELETE FROM ai_chat_history WHERE user_id = %s", (user_id,))
            # 插入新记录
            for msg in chat_messages[-50:]:  # 限制最多50条
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    cursor.execute("""
                        INSERT INTO ai_chat_history (user_id, role, content)
                        VALUES (%s, %s, %s)
                    """, (user_id, msg['role'], msg['content']))
        
        # 上传语用收藏夹
        if 'expression_favorites' in body and isinstance(body['expression_favorites'], list):
            expr_favorites = body['expression_favorites']
            for fav in expr_favorites:
                if isinstance(fav, dict) and fav.get('id'):
                    expr_id = str(fav.get('id', ''))
                    expr_data = json.dumps(fav) if not isinstance(fav, str) else fav
                    # 使用 ON CONFLICT 避免重复
                    cursor.execute("""
                        INSERT INTO expression_favorites (user_id, expression_data, expression_id)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (user_id, expression_id) 
                        DO UPDATE SET expression_data = EXCLUDED.expression_data
                    """, (user_id, expr_data, expr_id))
        
        # 上传词典收藏夹
        if 'dict_favorites' in body and isinstance(body['dict_favorites'], list):
            dict_favorites = body['dict_favorites']
            for fav in dict_favorites:
                if isinstance(fav, dict) and fav.get('word'):
                    word = fav['word']
                    phonetic = fav.get('phonetic', '')
                    pos = json.dumps(fav.get('pos', {})) if not isinstance(fav.get('pos'), str) else fav.get('pos', '{}')
                    # 使用 ON CONFLICT 避免重复
                    cursor.execute("""
                        INSERT INTO dict_favorites (user_id, word, phonetic, pos)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (user_id, word) 
                        DO UPDATE SET phonetic = EXCLUDED.phonetic, pos = EXCLUDED.pos
                    """, (user_id, word, phonetic, pos))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'message': '数据上传成功'
            })
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': f'上传失败: {str(e)}'
            })
        }

def verify_user(request):
    """验证用户身份，返回user_id或None"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.replace('Bearer ', '')
    try:
        payload = verify_jwt(token)
        user_id = payload.get('user_id')
        return user_id if user_id else None
    except:
        return None

