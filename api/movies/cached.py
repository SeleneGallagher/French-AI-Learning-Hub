"""
电影缓存API - 返回数据库中缓存的电影列表
支持分页、筛选和排序
"""
import json
from lib.utils import json_response, get_db_cursor

def handler(request):
    """处理电影缓存API请求"""
    try:
        # 获取请求方法
        if isinstance(request, dict):
            method = request.get('httpMethod', 'GET')
            query_params = request.get('queryStringParameters') or {}
        else:
            method = getattr(request, 'method', 'GET')
            if hasattr(request, 'args') and request.args:
                query_params = dict(request.args)
            elif hasattr(request, 'queryStringParameters'):
                query_params = request.queryStringParameters or {}
            else:
                query_params = {}
        
        method = method.upper() if method else 'GET'
        
        if method == 'OPTIONS':
            return json_response({}, 200)
        
        # 处理POST请求（上传电影到缓存）
        if method == 'POST':
            return handle_upload(request)
        
        if method != 'GET':
            return json_response({'success': False, 'message': 'Method not allowed'}, 405)
        
        # 解析查询参数
        page = int(query_params.get('page', 1))
        limit = min(int(query_params.get('limit', 25)), 100)  # 最多100条
        movie_type = query_params.get('type', 'mixed')  # movie, tv, mixed
        category = query_params.get('category', 'all')  # recent, classic, all
        min_rating = float(query_params.get('min_rating', 7.0))
        
        # 构建SQL查询
        where_conditions = ['rating >= %s']
        params = [min_rating]
        
        # 类型筛选
        if movie_type != 'mixed':
            where_conditions.append('type = %s')
            params.append(movie_type)
        
        # 分类筛选
        if category == 'recent':
            where_conditions.append('is_recent = TRUE')
        elif category == 'classic':
            where_conditions.append('is_classic = TRUE')
        
        where_clause = ' AND '.join(where_conditions)
        
        # 排序逻辑
        order_by = []
        if category == 'recent':
            order_by.append('is_recent DESC')
        elif category == 'classic':
            order_by.append('is_classic DESC')
        order_by.extend(['rating DESC', 'year DESC NULLS LAST'])
        order_clause = ', '.join(order_by)
        
        # 计算总数
        count_sql = f"""
        SELECT COUNT(*) FROM cached_movies
        WHERE {where_clause}
        """
        
        cur = get_db_cursor()
        cur.execute(count_sql, params)
        total = cur.fetchone()['count']
        
        # 分页查询
        offset = (page - 1) * limit
        query_sql = f"""
        SELECT 
            id, tmdb_id, type, title, original_title, year, release_date,
            rating, vote_count, poster_path, backdrop_path,
            plot, plot_truncated, tagline, tagline_truncated,
            director, genres, runtime, seasons, episodes, media_info,
            is_recent, is_classic
        FROM cached_movies
        WHERE {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
        """
        
        cur.execute(query_sql, params + [limit, offset])
        rows = cur.fetchall()
        
        # 关闭游标和连接
        conn = cur.connection
        cur.close()
        if conn and not conn.closed:
            conn.close()
        
        # 转换为前端需要的格式
        movies = []
        for row in rows:
            movie = {
                'id': row['tmdb_id'],
                'tmdb_id': row['tmdb_id'],
                'type': row['type'],
                'title': row['title'],
                'originalTitle': row.get('original_title', ''),
                'year': row.get('year', 0),
                'rating': float(row['rating']),
                'poster': f"https://image.tmdb.org/t/p/w500{row['poster_path']}" if row.get('poster_path') else '',
                'plot': row.get('plot_truncated', row.get('plot', '')),
                'fullPlot': row.get('plot', ''),
                'tagline': row.get('tagline_truncated', row.get('tagline', '')),
                'director': row.get('director', ''),
                'genres': row.get('genres') if isinstance(row.get('genres'), list) else (row.get('genres') or []),
                'runtime': row.get('runtime', 0),
                'mediaInfo': row.get('media_info', ''),
                'isRecent': row.get('is_recent', False),
                'isClassic': row.get('is_classic', False),
                'translatedPlot': ''
            }
            
            # 处理剧集的seasons和episodes
            if row['type'] == 'tv':
                if row.get('seasons'):
                    movie['seasons'] = row['seasons']
                if row.get('episodes'):
                    movie['episodes'] = row['episodes']
            
            movies.append(movie)
        
        # 计算总页数
        total_pages = (total + limit - 1) // limit
        
        return json_response({
            'success': True,
            'data': {
                'movies': movies,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'totalPages': total_pages
                }
            }
        })
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return json_response({
            'success': False,
            'message': f'服务器错误: {error_msg}',
            'error_code': 'CACHE_API_ERROR'
        }, 500)


