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
    # Vercel Python runtime 使用 request['httpMethod'] 或 request.get('httpMethod')
    if isinstance(request, dict):
        method = request.get('httpMethod', 'GET')
    else:
        method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
    method = method.upper() if method else 'GET'
    
    # 处理 CORS 预检请求
    if method == 'OPTIONS':
        return json_response({}, 200)
    
    if method != 'GET':
        return json_response({'success': False, 'message': f'Method not allowed. Got: {method}'}, 405)
    
    if not TMDB_API_KEY:
        return json_response({'success': False, 'message': 'TMDB API Key未配置'}, 500)
    
    try:
        import random
        
        # 获取查询参数（兼容Flask和Vercel格式）
        if isinstance(request, dict):
            # Vercel格式
            query_params = request.get('queryStringParameters') or {}
        else:
            # Flask格式（通过VercelRequest适配）
            if hasattr(request, 'args'):
                query_params = dict(request.args) if request.args else {}
            else:
                query_params = {}
        
        # 支持随机页面和不同排序方式
        # 如果请求参数中有refresh=true，使用随机页面和排序
        refresh_param = query_params.get('refresh', '')
        is_refresh = str(refresh_param).lower() == 'true'
        
        if is_refresh:
            # 刷新时：随机页面（1-10页，增加随机性）和随机排序方式
            page = random.randint(1, 10)
            sort_options = [
                'popularity.desc',
                'popularity.asc',
                'vote_average.desc',
                'vote_average.asc',
                'release_date.desc',
                'release_date.asc',
                'vote_count.desc',
                'vote_count.asc',
                'primary_release_date.desc',
                'primary_release_date.asc'
            ]
            sort_by = random.choice(sort_options)
        else:
            # 正常加载：使用第一页和默认排序
            page = 1
            sort_by = 'popularity.desc'
        
        # 随机选择获取电影或剧集（刷新时增加多样性）
        if is_refresh:
            content_type = random.choice(['movie', 'tv'])
        else:
            content_type = 'movie'  # 默认先显示电影
        
        # 服务器代理TMDB API
        url = f'https://api.themoviedb.org/3/discover/{content_type}'
        
        # 根据类型设置不同的参数
        if content_type == 'movie':
            params = {
                'api_key': TMDB_API_KEY,
                'language': 'fr-FR',
                'with_original_language': 'fr',
                'sort_by': sort_by,
                'vote_average.gte': 6.5,
                'vote_count.gte': 30,  # 确保有足够的评分数量，保证质量
                'page': page
            }
        else:  # tv
            params = {
                'api_key': TMDB_API_KEY,
                'language': 'fr-FR',
                'with_original_language': 'fr',
                'sort_by': sort_by,
                'vote_average.gte': 6.5,
                'vote_count.gte': 20,  # 剧集评分数量要求稍低
                'page': page
            }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.ok:
            data = response.json()
            # 处理数据，添加poster完整URL和media_type
            results = data.get('results', [])[:20]
            for item in results:
                if item.get('poster_path'):
                    item['poster_path'] = f'https://image.tmdb.org/t/p/w500{item["poster_path"]}'
                # 添加media_type字段，方便前端识别
                item['media_type'] = content_type
            
            return json_response({
                'success': True,
                'data': results
            })
        else:
            return json_response({'success': False, 'message': f'TMDB API错误: {response.status_code}'}, 500)
            
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)


