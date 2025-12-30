"""
DeepSeek API代理 - 后端调用，使用环境变量
"""
import os
import json
import requests
from lib.utils import json_response

def handler(request):
    """代理DeepSeek API调用"""
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
            data = request.get_json() if hasattr(request, 'get_json') else {}
        
        prompt = data.get('prompt', '')
        model = data.get('model', 'deepseek-chat')
        
        if not prompt:
            return json_response({'success': False, 'message': '请提供prompt'}, 400)
        
        # 从环境变量获取API密钥
        api_key = os.environ.get('DEEPSEEK_API_KEY')
        
        if not api_key:
            return json_response({'success': False, 'message': 'DeepSeek API未配置'}, 400)
        
        # 调用DeepSeek API
        url = 'https://api.deepseek.com/v1/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        payload = {
            'model': model,
            'messages': [{
                'role': 'user',
                'content': prompt
            }],
            'temperature': 1.3,
            'stream': False
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code != 200:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            return json_response({
                'success': False,
                'message': error_data.get('error', {}).get('message') or f'DeepSeek API错误: {response.status_code}'
            }, response.status_code)
        
        result = response.json()
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
        
        return json_response({
            'success': True,
            'content': content
        }, 200)
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)

