"""
用户数据同步API - 获取用户的AI聊天记录和收藏夹
"""
import os
import json
import jwt
from lib.utils import get_db_connection, verify_jwt

def handler(request):
    if request.method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': 'Method not allowed'
            })
        }
    
    # 验证JWT token
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': '未授权，请先登录'
            })
        }
    
    token = auth_header.replace('Bearer ', '')
    try:
        payload = verify_jwt(token)
        user_id = payload.get('user_id')
        if not user_id:
            raise ValueError('Invalid token')
    except Exception as e:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': 'Token无效或已过期'
            })
        }
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 获取AI聊天记录
        cursor.execute("""
            SELECT conversation_id, messages, created_at, updated_at
            FROM ai_chat_history
            WHERE user_id = %s
            ORDER BY updated_at DESC
            LIMIT 100
        """, (user_id,))
        chat_records = []
        for row in cursor.fetchall():
            chat_records.append({
                'conversation_id': str(row[0]),
                'messages': row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else [],
                'created_at': row[2].isoformat() if row[2] else None,
                'updated_at': row[3].isoformat() if row[3] else None
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

