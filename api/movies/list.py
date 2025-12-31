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
        
        # 获取查询参数
        refresh_param = query_params.get('refresh', '')
        is_refresh = str(refresh_param).lower() == 'true'
        category = query_params.get('category', '')  # recent, classic, other
        content_type_param = query_params.get('type', '')  # movie, tv
        
        from datetime import datetime
        current_year = datetime.now().year
        
        # 根据category设置查询参数
        if category == 'recent':
            # 近两年
            page = random.randint(1, 5) if is_refresh else 1
            sort_by = 'popularity.desc'
            if not content_type_param:
                content_type = random.choice(['movie', 'tv']) if is_refresh else 'movie'
            else:
                content_type = content_type_param
        elif category == 'classic':
            # 经典（5年前）
            page = random.randint(1, 5) if is_refresh else 1
            sort_by = 'vote_average.desc'
            if not content_type_param:
                content_type = random.choice(['movie', 'tv']) if is_refresh else 'movie'
            else:
                content_type = content_type_param
        else:
            # 其他（默认）
            if is_refresh:
                page = random.randint(1, 10)
                sort_options = [
                    'popularity.desc', 'popularity.asc',
                    'vote_average.desc', 'vote_average.asc',
                    'release_date.desc', 'release_date.asc',
                    'vote_count.desc', 'vote_count.asc',
                    'primary_release_date.desc', 'primary_release_date.asc'
                ]
                sort_by = random.choice(sort_options)
            else:
                page = 1
                sort_by = 'popularity.desc'
            
            if not content_type_param:
                content_type = random.choice(['movie', 'tv']) if is_refresh else 'movie'
            else:
                content_type = content_type_param
        
        # 服务器代理TMDB API
        url = f'https://api.themoviedb.org/3/discover/{content_type}'
        
        # 根据类型和category设置不同的参数
        if content_type == 'movie':
            params = {
                'api_key': TMDB_API_KEY,
                'language': 'fr-FR',
                'with_original_language': 'fr',
                'sort_by': sort_by,
                'vote_average.gte': 7.0,
                'vote_count.gte': 30,  # 确保有足够的评分数量，保证质量
                'page': page
            }
            if category == 'recent':
                params['primary_release_date.gte'] = f'{current_year - 2}-01-01'
            elif category == 'classic':
                params['primary_release_date.lte'] = f'{current_year - 5}-12-31'
                params['vote_count.gte'] = 300  # 经典电影需要更多评分
        else:  # tv
            params = {
                'api_key': TMDB_API_KEY,
                'language': 'fr-FR',
                'with_original_language': 'fr',
                'sort_by': sort_by,
                'vote_average.gte': 7.0,
                'vote_count.gte': 20,  # 剧集评分数量要求稍低
                'page': page
            }
            if category == 'recent':
                params['first_air_date.gte'] = f'{current_year - 2}-01-01'
            elif category == 'classic':
                params['first_air_date.lte'] = f'{current_year - 5}-12-31'
                params['vote_count.gte'] = 100  # 经典剧集需要更多评分
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.ok:
            data = response.json()
            # 处理数据，添加poster完整URL和media_type
            # 增加返回数量，确保有足够的数据
            results = data.get('results', [])[:30]
            
            # 为每个项目获取详细信息（包括导演、类型、评语等）
            detailed_results = []
            import time
            for idx, item in enumerate(results):
                try:
                    # 获取详细信息（所有项目都获取）
                    detail_url = f'https://api.themoviedb.org/3/{content_type}/{item["id"]}'
                    detail_params = {
                        'api_key': TMDB_API_KEY,
                        'language': 'fr-FR',
                        'append_to_response': 'credits'
                    }
                    detail_response = requests.get(detail_url, params=detail_params, timeout=5)
                    
                    if detail_response.ok:
                        detail_data = detail_response.json()
                        # 合并详细信息
                        item.update({
                            'tagline': detail_data.get('tagline', ''),
                            'runtime': detail_data.get('runtime', 0),
                            'genres': detail_data.get('genres', []),
                            'number_of_seasons': detail_data.get('number_of_seasons', 0),
                            'number_of_episodes': detail_data.get('number_of_episodes', 0),
                            'created_by': detail_data.get('created_by', [])
                        })
                        
                        # 提取导演/创作者
                        if content_type == 'movie' and detail_data.get('credits', {}).get('crew'):
                            director = next((c['name'] for c in detail_data['credits']['crew'] if c.get('job') == 'Director'), '')
                            if director:
                                item['director'] = director
                        elif content_type == 'tv' and detail_data.get('created_by'):
                            creator = detail_data['created_by'][0]['name'] if detail_data['created_by'] else ''
                            if creator:
                                item['creator'] = creator
                    
                    # 避免API限流，稍微延迟
                    if idx < len(results) - 1:
                        time.sleep(0.1)
                except Exception as e:
                    # 如果获取详情失败，继续使用基础数据
                    pass
                
                # 处理poster路径
                if item.get('poster_path'):
                    item['poster_path'] = f'https://image.tmdb.org/t/p/w500{item["poster_path"]}'
                # 添加media_type字段
                item['media_type'] = content_type
                detailed_results.append(item)
            
            return json_response({
                'success': True,
                'data': detailed_results
            })
        else:
            return json_response({'success': False, 'message': f'TMDB API错误: {response.status_code}'}, 500)
            
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)


