"""
Coze API代理 - 后端调用，使用环境变量
"""
import os
import json
import requests
from lib.utils import json_response

def handler(request):
    """代理Coze API调用"""
    # 获取请求方法（兼容不同的 request 对象格式）
    # Vercel Python runtime 使用 request['httpMethod'] 或 request.get('httpMethod')
    if isinstance(request, dict):
        method = request.get('httpMethod', 'GET')
    else:
        method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
    method = method.upper() if method else 'GET'
    
    # 处理 CORS 预检请求
    if method == 'OPTIONS':
        return json_response({}, 200)
    
    if method != 'POST':
        return json_response({'success': False, 'message': f'Method not allowed. Got: {method}'}, 405)
    
    try:
        # Vercel Serverless Functions格式
        if isinstance(request, dict):
            # Vercel格式：request是字典，body是字符串
            body_str = request.get('body', '{}')
            if isinstance(body_str, str):
                data = json.loads(body_str) if body_str else {}
            else:
                data = body_str if body_str else {}
        elif hasattr(request, 'body'):
            if isinstance(request.body, str):
                data = json.loads(request.body) if request.body else {}
            elif isinstance(request.body, dict):
                data = request.body
            else:
                data = json.loads(request.body) if request.body else {}
        else:
            # Flask格式或其他
            try:
                # 优先使用get_json方法
                if hasattr(request, 'get_json'):
                    data = request.get_json() or {}
                # 如果没有，尝试json属性
                elif hasattr(request, 'json') and request.json:
                    data = request.json
                # 尝试从body获取
                elif hasattr(request, 'body'):
                    if isinstance(request.body, str):
                        data = json.loads(request.body) if request.body else {}
                    elif isinstance(request.body, dict):
                        data = request.body
                    else:
                        data = {}
                # 最后尝试form
                elif hasattr(request, 'form'):
                    data = dict(request.form)
                else:
                    data = {}
            except Exception as e:
                print(f"解析请求数据失败: {e}")
                data = {}
        
        prompt = data.get('prompt', '') or data.get('content', '') or data.get('message', '') or ''
        user_id = data.get('user_id', '')
        conversation_id = data.get('conversation_id', '')
        
        if not prompt:
            return json_response({'success': False, 'message': '请提供prompt'}, 400)
        
        # 从环境变量获取配置
        bot_id = os.environ.get('COZE_BOT_ID')
        pat_token = os.environ.get('COZE_PAT_TOKEN') or os.environ.get('COZE_SAT_TOKEN')
        
        if not bot_id or not pat_token:
            return json_response({'success': False, 'message': 'Coze API未配置'}, 400)
        
        # 调用Coze API
        url = 'https://api.coze.cn/v3/chat'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {pat_token}'
        }
        
        payload = {
            'bot_id': bot_id,
            'user_id': user_id or f'user_{os.urandom(8).hex()}',
            'stream': True,
            'auto_save_history': True,
            'additional_messages': [{
                'role': 'user',
                'content': prompt,
                'content_type': 'text'
            }]
        }
        
        if conversation_id:
            payload['conversation_id'] = conversation_id
        
        response = requests.post(url, headers=headers, json=payload, stream=True)
        
        if response.status_code != 200:
            try:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                error_msg = error_data.get('msg') or error_data.get('message') or f'Coze API错误: {response.status_code}'
            except:
                error_msg = f'Coze API错误: {response.status_code}'
            return json_response({
                'success': False,
                'message': error_msg
            }, response.status_code)
        
        # 返回流式响应
        def generate():
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data:'):
                        yield f"data: {line_str[5:].strip()}\n\n"
                    elif line_str.startswith('event:'):
                        yield f"event: {line_str[6:].strip()}\n\n"
        
        # 对于Vercel，我们需要返回完整的响应
        # 这里简化处理，返回非流式响应
        full_content = ''
        conversation_id_result = None
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data:'):
                    try:
                        data = json.loads(line_str[5:].strip())
                        if data.get('type') == 'answer' and data.get('content'):
                            full_content = data.get('content', '')
                        if data.get('conversation_id'):
                            conversation_id_result = data.get('conversation_id')
                        if data.get('type') == 'done':
                            break
                    except:
                        pass
        
        return json_response({
            'success': True,
            'content': full_content,
            'conversation_id': conversation_id_result
        }, 200)
        
    except requests.exceptions.RequestException as e:
        return json_response({
            'success': False,
            'message': f'Coze API请求失败: {str(e)}',
            'type': 'network_error'
        }, 500)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return json_response({
            'success': False,
            'message': f'服务器错误: {str(e)}',
            'type': 'server_error'
        }, 500)

