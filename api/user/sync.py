"""
用户数据同步API - 获取用户的AI聊天记录和收藏夹
"""
import os
import json
import jwt
from lib.utils import get_db_connection, verify_token

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
        
        # 获取背单词进度
        cursor.execute("""
            SELECT word, quality, count, last_review
            FROM vocab_progress
            WHERE user_id = %s
            ORDER BY last_review DESC
        """, (user_id,))
        vocab_progress = []
        for row in cursor.fetchall():
            vocab_progress.append({
                'word': row[0],
                'quality': row[1],
                'count': row[2],
                'last_review': row[3].isoformat() if row[3] else None
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
                    'dict_favorites': dict_favorites,
                    'vocab_progress': vocab_progress
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
        
        # 上传背单词进度
        if 'vocab_progress' in body and isinstance(body['vocab_progress'], (dict, list)):
            vocab_data = body['vocab_progress']
            # 支持字典格式 {word: {quality, count, lastReview}}
            if isinstance(vocab_data, dict):
                for word, progress in vocab_data.items():
                    if isinstance(progress, dict) and word:
                        quality = progress.get('quality', 0)
                        count = progress.get('count', 0)
                        last_review = progress.get('lastReview') or progress.get('last_review')
                        # 转换时间戳为datetime
                        from datetime import datetime
                        if last_review:
                            if isinstance(last_review, (int, float)):
                                last_review_dt = datetime.fromtimestamp(last_review / 1000 if last_review > 1e10 else last_review)
                            else:
                                try:
                                    last_review_dt = datetime.fromisoformat(str(last_review).replace('Z', '+00:00'))
                                except:
                                    last_review_dt = datetime.now()
                        else:
                            last_review_dt = datetime.now()
                        
                        cursor.execute("""
                            INSERT INTO vocab_progress (user_id, word, quality, count, last_review)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (user_id, word) 
                            DO UPDATE SET 
                                quality = EXCLUDED.quality,
                                count = EXCLUDED.count,
                                last_review = EXCLUDED.last_review
                        """, (user_id, word, quality, count, last_review_dt))
            # 支持数组格式
            elif isinstance(vocab_data, list):
                for item in vocab_data:
                    if isinstance(item, dict) and item.get('word'):
                        word = item['word']
                        quality = item.get('quality', 0)
                        count = item.get('count', 0)
                        last_review = item.get('last_review') or item.get('lastReview')
                        from datetime import datetime
                        if last_review:
                            if isinstance(last_review, (int, float)):
                                last_review_dt = datetime.fromtimestamp(last_review / 1000 if last_review > 1e10 else last_review)
                            else:
                                try:
                                    last_review_dt = datetime.fromisoformat(str(last_review).replace('Z', '+00:00'))
                                except:
                                    last_review_dt = datetime.now()
                        else:
                            last_review_dt = datetime.now()
                        
                        cursor.execute("""
                            INSERT INTO vocab_progress (user_id, word, quality, count, last_review)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (user_id, word) 
                            DO UPDATE SET 
                                quality = EXCLUDED.quality,
                                count = EXCLUDED.count,
                                last_review = EXCLUDED.last_review
                        """, (user_id, word, quality, count, last_review_dt))
        
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
    # 使用 verify_token 函数，它直接返回 user_id
    user_id = verify_token(request)
    return user_id

