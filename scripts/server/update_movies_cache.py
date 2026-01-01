#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电影缓存更新脚本 - 从TMDB获取数据并存储到数据库
定期运行此脚本更新电影缓存，供前端快速加载
"""

import os
import sys
import time
import requests
from datetime import datetime
from urllib.parse import urlparse, parse_qs

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.utils import get_db_connection

# 配置参数
MIN_RATING = 7.5
TARGET_COUNT = 200
MAX_PAGES_PER_CATEGORY = 20
CACHE_EXPIRY_DAYS = 7

TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '')
TMDB_BASE_URL = 'https://api.themoviedb.org/3'

# 类型映射
GENRE_MAP = {
    28: '动作', 12: '冒险', 16: '动画', 35: '喜剧', 80: '犯罪',
    99: '纪录片', 18: '剧情', 10751: '家庭', 14: '奇幻', 36: '历史',
    27: '恐怖', 10402: '音乐', 9648: '悬疑', 10749: '爱情', 878: '科幻',
    10770: '电视电影', 53: '惊悚', 10752: '战争', 37: '西部',
    10759: '动作冒险', 10762: '儿童', 10763: '新闻', 10764: '真人秀',
    10765: '科幻奇幻', 10766: '肥皂剧', 10767: '脱口秀', 10768: '战争政治'
}

def is_french_text(text):
    """检查是否为法语文本"""
    if not text or len(text) < 20:
        return False
    french_chars = r'[àâäéèêëïîôùûüÿç]'
    import re
    return bool(re.search(french_chars, text, re.IGNORECASE))

def fetch_from_tmdb(endpoint, params=None):
    """从TMDB API获取数据"""
    if params is None:
        params = {}
    params['api_key'] = TMDB_API_KEY
    params['language'] = 'fr-FR'
    
    url = f'{TMDB_BASE_URL}{endpoint}'
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"TMDB API调用失败: {endpoint}, 错误: {e}")
        return None

def get_movie_details(movie_id, movie_type='movie'):
    """获取电影/剧集的详细信息"""
    endpoint = f'/{movie_type}/{movie_id}'
    params = {'append_to_response': 'credits'}
    return fetch_from_tmdb(endpoint, params)

def process_movie_item(item, movie_type='movie'):
    """处理电影/剧集数据，返回数据库记录格式"""
    details = get_movie_details(item['id'], movie_type)
    if not details:
        return None
    
    # 必须有tagline
    tagline = details.get('tagline', '') or ''
    if not tagline or not tagline.strip():
        return None
    
    # 必须有法语简介
    plot = details.get('overview', '') or item.get('overview', '') or ''
    if not plot or not is_french_text(plot):
        return None
    
    # 提取导演/创作者
    director = ''
    if movie_type == 'movie':
        if details.get('credits') and details['credits'].get('crew'):
            director_obj = next((c for c in details['credits']['crew'] if c.get('job') == 'Director'), None)
            if director_obj:
                director = director_obj.get('name', '')
    else:  # tv
        if details.get('created_by') and len(details['created_by']) > 0:
            director = details['created_by'][0].get('name', '')
    
    # 处理类型
    genres = []
    if details.get('genres'):
        genres = [g.get('name', '') for g in details['genres'][:3]]
    elif item.get('genre_ids'):
        genres = [GENRE_MAP.get(gid, '') for gid in item['genre_ids'][:3] if GENRE_MAP.get(gid)]
    
    if not genres:
        genres = ['法语电影'] if movie_type == 'movie' else ['法语剧集']
    
    # 处理日期和年份
    release_date = item.get('release_date') or details.get('release_date') or (item.get('first_air_date') or details.get('first_air_date'))
    year = None
    if release_date:
        try:
            year = datetime.strptime(release_date, '%Y-%m-%d').year
        except:
            pass
    
    current_year = datetime.now().year
    is_recent = year and year >= current_year - 2
    is_classic = year and year < current_year - 5
    
    # 处理时长信息
    runtime = details.get('runtime', 0) if movie_type == 'movie' else 0
    seasons = details.get('number_of_seasons', 0) if movie_type == 'tv' else 0
    episodes = details.get('number_of_episodes', 0) if movie_type == 'tv' else 0
    
    # 格式化media_info
    media_info = ''
    if movie_type == 'movie' and runtime:
        media_info = f'{runtime}分钟'
    elif movie_type == 'tv' and seasons:
        media_info = f'{seasons}季'
        if episodes:
            media_info += f' · {episodes}集'
    
    # 截断文本
    plot_truncated = plot[:150] + '...' if len(plot) > 150 else plot
    tagline_truncated = tagline[:60] + '...' if len(tagline) > 60 else tagline
    
    return {
        'tmdb_id': item['id'],
        'type': movie_type,
        'title': item.get('title') or item.get('name', ''),
        'original_title': item.get('original_title') or item.get('original_name', ''),
        'year': year,
        'release_date': release_date,
        'rating': float(item.get('vote_average', 0)),
        'vote_count': item.get('vote_count', 0),
        'poster_path': item.get('poster_path', ''),
        'backdrop_path': item.get('backdrop_path', ''),
        'plot': plot,
        'plot_truncated': plot_truncated,
        'tagline': tagline,
        'tagline_truncated': tagline_truncated,
        'director': director,
        'genres': genres,
        'runtime': runtime,
        'seasons': seasons,
        'episodes': episodes,
        'media_info': media_info,
        'is_recent': is_recent,
        'is_classic': is_classic
    }

def update_cache():
    """更新电影缓存"""
    if not TMDB_API_KEY:
        print("错误: 未设置 TMDB_API_KEY")
        return False
    
    print("=" * 50)
    print("开始更新电影缓存...")
    print("=" * 50)
    
    current_year = datetime.now().year
    all_items = []
    seen_ids = set()
    
    # 定义获取数据的函数
    def fetch_category(category_type, is_recent, movie_type='movie'):
        """获取指定类别的数据"""
        items = []
        for page in range(1, MAX_PAGES_PER_CATEGORY + 1):
            if movie_type == 'movie':
                if is_recent:
                    endpoint = '/discover/movie'
                    params = {
                        'with_original_language': 'fr',
                        'sort_by': 'popularity.desc',
                        'vote_count.gte': 30,
                        'vote_average.gte': MIN_RATING,
                        'primary_release_date.gte': f'{current_year - 2}-01-01',
                        'page': page
                    }
                else:
                    endpoint = '/discover/movie'
                    params = {
                        'with_original_language': 'fr',
                        'sort_by': 'vote_average.desc',
                        'vote_count.gte': 300,
                        'vote_average.gte': MIN_RATING,
                        'primary_release_date.lte': f'{current_year - 5}-12-31',
                        'page': page
                    }
            else:  # tv
                if is_recent:
                    endpoint = '/discover/tv'
                    params = {
                        'with_original_language': 'fr',
                        'sort_by': 'popularity.desc',
                        'vote_count.gte': 20,
                        'vote_average.gte': MIN_RATING,
                        'first_air_date.gte': f'{current_year - 2}-01-01',
                        'page': page
                    }
                else:
                    endpoint = '/discover/tv'
                    params = {
                        'with_original_language': 'fr',
                        'sort_by': 'vote_average.desc',
                        'vote_count.gte': 100,
                        'vote_average.gte': MIN_RATING,
                        'first_air_date.lte': f'{current_year - 5}-12-31',
                        'page': page
                    }
            
            data = fetch_from_tmdb(endpoint, params)
            if not data or not data.get('results'):
                break
            
            results = data['results']
            for item in results:
                item_id = f"{movie_type}_{item['id']}"
                if item_id not in seen_ids:
                    seen_ids.add(item_id)
                    items.append((item, movie_type))
            
            if len(results) < 20:
                break
            
            time.sleep(0.3)  # 避免API限流
        
        return items
    
    # 获取所有类别的数据
    print("获取近两年电影...")
    all_items.extend(fetch_category('recent', True, 'movie'))
    
    print("获取经典电影...")
    all_items.extend(fetch_category('classic', False, 'movie'))
    
    print("获取其他电影...")
    for page in range(1, 6):  # 其他电影少获取几页
        endpoint = '/discover/movie'
        params = {
            'with_original_language': 'fr',
            'sort_by': 'popularity.desc',
            'vote_count.gte': 50,
            'vote_average.gte': MIN_RATING,
            'page': page
        }
        data = fetch_from_tmdb(endpoint, params)
        if data and data.get('results'):
            for item in data['results']:
                item_id = f"movie_{item['id']}"
                if item_id not in seen_ids:
                    seen_ids.add(item_id)
                    all_items.append((item, 'movie'))
            if len(data['results']) < 20:
                break
        time.sleep(0.3)
    
    print("获取近两年剧集...")
    all_items.extend(fetch_category('recent', True, 'tv'))
    
    print("获取经典剧集...")
    all_items.extend(fetch_category('classic', False, 'tv'))
    
    print("获取其他剧集...")
    for page in range(1, 6):
        endpoint = '/discover/tv'
        params = {
            'with_original_language': 'fr',
            'sort_by': 'popularity.desc',
            'vote_count.gte': 30,
            'vote_average.gte': MIN_RATING,
            'page': page
        }
        data = fetch_from_tmdb(endpoint, params)
        if data and data.get('results'):
            for item in data['results']:
                item_id = f"tv_{item['id']}"
                if item_id not in seen_ids:
                    seen_ids.add(item_id)
                    all_items.append((item, 'tv'))
            if len(data['results']) < 20:
                break
        time.sleep(0.3)
    
    print(f"共获取 {len(all_items)} 个唯一项目，开始处理详细信息...")
    
    # 处理每个项目
    processed_items = []
    for idx, (item, movie_type) in enumerate(all_items):
        if len(processed_items) >= TARGET_COUNT:
            break
        
        try:
            processed = process_movie_item(item, movie_type)
            if processed:
                processed_items.append(processed)
                print(f"处理进度: {len(processed_items)}/{TARGET_COUNT} - {processed['title']}")
        except Exception as e:
            print(f"处理项目失败: {item.get('id')}, 错误: {e}")
        
        time.sleep(0.2)  # 避免API限流
    
    print(f"处理完成，共 {len(processed_items)} 个有效项目")
    
    # 插入/更新数据库
    if not processed_items:
        print("没有有效数据，跳过数据库更新")
        return False
    
    conn = get_db_connection()
    if not conn:
        print("错误: 无法连接数据库")
        return False
    
    try:
        cur = conn.cursor()
        
        # 使用UPSERT更新数据
        insert_sql = """
        INSERT INTO cached_movies (
            tmdb_id, type, title, original_title, year, release_date,
            rating, vote_count, poster_path, backdrop_path,
            plot, plot_truncated, tagline, tagline_truncated,
            director, genres, runtime, seasons, episodes, media_info,
            is_recent, is_classic
        ) VALUES (
            %(tmdb_id)s, %(type)s, %(title)s, %(original_title)s, %(year)s, %(release_date)s,
            %(rating)s, %(vote_count)s, %(poster_path)s, %(backdrop_path)s,
            %(plot)s, %(plot_truncated)s, %(tagline)s, %(tagline_truncated)s,
            %(director)s, %(genres)s::jsonb, %(runtime)s, %(seasons)s, %(episodes)s, %(media_info)s,
            %(is_recent)s, %(is_classic)s
        )
        ON CONFLICT (tmdb_id, type) 
        DO UPDATE SET
            title = EXCLUDED.title,
            original_title = EXCLUDED.original_title,
            year = EXCLUDED.year,
            release_date = EXCLUDED.release_date,
            rating = EXCLUDED.rating,
            vote_count = EXCLUDED.vote_count,
            poster_path = EXCLUDED.poster_path,
            backdrop_path = EXCLUDED.backdrop_path,
            plot = EXCLUDED.plot,
            plot_truncated = EXCLUDED.plot_truncated,
            tagline = EXCLUDED.tagline,
            tagline_truncated = EXCLUDED.tagline_truncated,
            director = EXCLUDED.director,
            genres = EXCLUDED.genres,
            runtime = EXCLUDED.runtime,
            seasons = EXCLUDED.seasons,
            episodes = EXCLUDED.episodes,
            media_info = EXCLUDED.media_info,
            is_recent = EXCLUDED.is_recent,
            is_classic = EXCLUDED.is_classic,
            updated_at = CURRENT_TIMESTAMP
        """
        
        for item in processed_items:
            cur.execute(insert_sql, item)
        
        conn.commit()
        print(f"✓ 成功更新 {len(processed_items)} 条记录到数据库")
        
        # 清理过期数据（可选）
        delete_sql = """
        DELETE FROM cached_movies 
        WHERE updated_at < NOW() - INTERVAL '%s days'
        """ % CACHE_EXPIRY_DAYS
        cur.execute(delete_sql)
        deleted_count = cur.rowcount
        if deleted_count > 0:
            print(f"✓ 清理了 {deleted_count} 条过期记录")
        
        conn.commit()
        cur.close()
        conn.close()
        
        print("=" * 50)
        print("电影缓存更新完成！")
        print("=" * 50)
        return True
        
    except Exception as e:
        import traceback
        print(f"数据库操作失败: {e}")
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == '__main__':
    update_cache()


