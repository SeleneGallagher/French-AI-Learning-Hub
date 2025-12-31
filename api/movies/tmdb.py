"""
TMDB API代理 - 直接代理TMDB API请求
"""
import os
import requests
from lib.utils import json_response

TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '')

def handler(request):
    if isinstance(request, dict):
        method = request.get('httpMethod', 'GET')
    else:
        method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
    method = method.upper() if method else 'GET'
    
    if method == 'OPTIONS':
        return json_response({}, 200)
    
    if method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    if not TMDB_API_KEY:
        return json_response({'success': False, 'message': 'TMDB API Key未配置'}, 500)
    
    try:
        # 获取路径参数
        if isinstance(request, dict):
            path = request.get('path', '') or request.get('pathParameters', {}).get('proxy', '')
            endpoint_path = request.get('endpoint_path', '')
        else:
            path = getattr(request, 'path', '') or ''
            endpoint_path = getattr(request, 'endpoint_path', '') or ''
        
        # 优先使用endpoint_path（Flask路由传递的）
        if endpoint_path:
            endpoint = endpoint_path
        elif path.startswith('/api/movies/tmdb'):
            endpoint = path.replace('/api/movies/tmdb', '')
        elif path.startswith('/movies/tmdb'):
            endpoint = path.replace('/movies/tmdb', '')
        else:
            # 从查询参数获取
            if isinstance(request, dict):
                query_params = request.get('queryStringParameters') or {}
            else:
                query_params = dict(request.args) if hasattr(request, 'args') and request.args else {}
            endpoint = query_params.get('endpoint', '/discover/movie')
        
        # 获取查询参数
        if isinstance(request, dict):
            query_params = request.get('queryStringParameters') or {}
        else:
            if hasattr(request, 'args') and request.args:
                query_params = dict(request.args)
            else:
                query_params = {}
        
        # 从endpoint中提取查询参数（如果endpoint包含?）
        if '?' in endpoint:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(endpoint)
            endpoint = parsed.path
            endpoint_params = parse_qs(parsed.query)
            # 将列表转换为单个值
            for k, v in endpoint_params.items():
                if isinstance(v, list) and len(v) > 0:
                    query_params[k] = v[0]
        
        # 构建TMDB API URL
        url = f'https://api.themoviedb.org/3{endpoint}'
        
        # 添加API密钥和查询参数
        params = {'api_key': TMDB_API_KEY, 'language': 'fr-FR'}
        params.update(query_params)
        
        # 调用TMDB API
        response = requests.get(url, params=params, timeout=10)
        
        if response.ok:
            return json_response(response.json())
        else:
            return json_response({'success': False, 'message': f'TMDB API错误: {response.status_code}'}, response.status_code)
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"TMDB API代理错误: {str(e)}")
        print(error_details)
        return json_response({'success': False, 'message': f'服务器错误: {str(e)}'}, 500)

