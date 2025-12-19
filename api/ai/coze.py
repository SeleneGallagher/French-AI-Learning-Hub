"""
Coze API代理 - 后端调用，使用环境变量
"""
import os
import json
import requests
from api.utils import json_response

def handler(request):
    """代理Coze API调用"""
    if request.method != 'POST':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        # Vercel Serverless Functions格式
        if hasattr(request, 'body'):
            if isinstance(request.body, str):
                data = json.loads(request.body)
            elif isinstance(request.body, dict):
                data = request.body
            else:
                data = json.loads(request.body) if request.body else {}
        else:
            # Flask格式或其他
            data = request.get_json() if hasattr(request, 'get_json') else {}
        
        prompt = data.get('prompt', '')
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
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            return json_response({
                'success': False,
                'message': error_data.get('msg') or error_data.get('message') or f'Coze API错误: {response.status_code}'
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
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)

