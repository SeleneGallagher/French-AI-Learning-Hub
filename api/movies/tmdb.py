"""
TMDB API代理 - 直接代理TMDB API请求
"""
import os
import requests
from lib.utils import json_response

TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '')

def handler(request):
    try:
        if isinstance(request, dict):
            method = request.get('httpMethod', 'GET')
        else:
            method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
        method = method.upper() if method else 'GET'
        
        if method == 'OPTIONS':
            return json_response({}, 200)
        
        if method != 'GET':
            return json_response({'success': False, 'message': 'Method not allowed'}, 405)
        
        # 检查API Key
        if not TMDB_API_KEY:
            print("ERROR: TMDB_API_KEY not configured")
            return json_response({
                'success': False, 
                'message': 'TMDB API Key未配置，请在Railway环境变量中设置TMDB_API_KEY',
                'error_code': 'MISSING_API_KEY'
            }, 500)
    
        # 获取路径参数
        if isinstance(request, dict):
            path = request.get('path', '') or request.get('pathParameters', {}).get('proxy', '')
            endpoint_path = request.get('endpoint_path', '')
        else:
            path = getattr(request, 'path', '') or ''
            endpoint_path = getattr(request, 'endpoint_path', '') or ''
        
        print(f"DEBUG: path={path}, endpoint_path={endpoint_path}")
        
        # 优先使用endpoint_path（Flask路由传递的）
        if endpoint_path:
            endpoint = endpoint_path
            # 确保endpoint以/开头
            if not endpoint.startswith('/'):
                endpoint = '/' + endpoint
        elif path.startswith('/api/movies/tmdb'):
            endpoint = path.replace('/api/movies/tmdb', '')
            if not endpoint.startswith('/'):
                endpoint = '/' + endpoint
        elif path.startswith('/movies/tmdb'):
            endpoint = path.replace('/movies/tmdb', '')
            if not endpoint.startswith('/'):
                endpoint = '/' + endpoint
        else:
            # 从查询参数获取
            if isinstance(request, dict):
                query_params = request.get('queryStringParameters') or {}
            else:
                query_params = dict(request.args) if hasattr(request, 'args') and request.args else {}
            endpoint = query_params.get('endpoint', '/discover/movie')
            if not endpoint.startswith('/'):
                endpoint = '/' + endpoint
        
        print(f"DEBUG: final endpoint={endpoint}")
        
        # 从endpoint中提取查询参数（如果endpoint包含?）
        query_params = {}
        if '?' in endpoint:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(endpoint)
            endpoint = parsed.path
            endpoint_params = parse_qs(parsed.query)
            # 将列表转换为单个值
            for k, v in endpoint_params.items():
                if isinstance(v, list) and len(v) > 0:
                    query_params[k] = v[0]
        
        # 从request获取额外的查询参数（如果endpoint中没有）
        if isinstance(request, dict):
            flask_params = request.get('queryStringParameters') or {}
        else:
            if hasattr(request, 'args') and request.args:
                flask_params = dict(request.args)
            elif hasattr(request, 'queryStringParameters'):
                flask_params = request.queryStringParameters or {}
            else:
                flask_params = {}
        
        # 合并查询参数（endpoint中的优先）
        query_params.update(flask_params)
        
        # 构建TMDB API URL
        url = f'https://api.themoviedb.org/3{endpoint}'
        
        # 添加API密钥和查询参数
        params = {'api_key': TMDB_API_KEY, 'language': 'fr-FR'}
        params.update(query_params)
        
        print(f"DEBUG: Calling TMDB API: {url} with params keys: {list(params.keys())}")
        
        # 调用TMDB API
        response = requests.get(url, params=params, timeout=10)
        
        if response.ok:
            return json_response(response.json())
        else:
            error_text = response.text[:200] if response.text else 'No error text'
            print(f"ERROR: TMDB API returned {response.status_code}: {error_text}")
            return json_response({
                'success': False, 
                'message': f'TMDB API错误: {response.status_code}',
                'tmdb_error': error_text
            }, response.status_code)
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"ERROR: TMDB API代理异常: {error_type}: {error_msg}")
        print(error_details)
        # 返回更详细的错误信息
        return json_response({
            'success': False, 
            'message': f'服务器错误: {error_msg}',
            'error_type': error_type,
            'error_code': 'HANDLER_EXCEPTION'
        }, 500)

