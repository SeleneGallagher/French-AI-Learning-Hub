"""
电影列表API - 代理TMDB API
"""
import json
import os
import requests
from lib.utils import json_response

TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '')

def handler(request):
    # 获取请求方法（兼容不同的 request 对象格式）
    method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
    method = method.upper()
    
    # 处理 CORS 预检请求
    if method == 'OPTIONS':
        return json_response({}, 200)
    
    if method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    if not TMDB_API_KEY:
        return json_response({'success': False, 'message': 'TMDB API Key未配置'}, 500)
    
    try:
        # 服务器代理TMDB API
        url = 'https://api.themoviedb.org/3/discover/movie'
        params = {
            'api_key': TMDB_API_KEY,
            'language': 'fr-FR',
            'with_original_language': 'fr',
            'sort_by': 'popularity.desc',
            'vote_average.gte': 6.5,
            'page': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.ok:
            data = response.json()
            # 处理数据，添加poster完整URL
            results = data.get('results', [])[:20]
            for item in results:
                if item.get('poster_path'):
                    item['poster_path'] = f'https://image.tmdb.org/t/p/w500{item["poster_path"]}'
            
            return json_response({
                'success': True,
                'data': results
            })
        else:
            return json_response({'success': False, 'message': f'TMDB API错误: {response.status_code}'}, 500)
            
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)


