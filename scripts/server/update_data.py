#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据更新服务 - 定时抓取新闻和电影数据
在服务器上运行此脚本，定时更新静态数据文件
"""

import json
import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

try:
    from dateutil import parser as date_parser
except ImportError:
    date_parser = None

# 项目根目录
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / 'public' / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 新闻源配置
NEWS_SOURCES = [
    {
        'url': 'https://www.france24.com/fr/rss',
        'name': 'F24'
    },
    {
        'url': 'https://www.lemonde.fr/rss/une.xml',
        'name': 'Le Monde'
    },
    {
        'url': 'https://www.franceinfo.fr/rss',
        'name': 'franceinfo'
    },
    {
        'url': 'https://www.20minutes.fr/rss/une.xml',
        'name': '20 Minutes'
    },
    {
        'url': 'https://www.rfi.fr/fr/rss',
        'name': 'RFI'
    }
]

def parse_rss(url, source_name):
    """解析RSS源并提取新闻条目
    
    Args:
        url: RSS源URL
        source_name: 新闻源名称
        
    Returns:
        list: 新闻条目列表，每个条目包含title, link, description等字段
    """
    try:
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        
        # 处理命名空间
        namespaces = {
            'atom': 'http://www.w3.org/2005/Atom',
            'dc': 'http://purl.org/dc/elements/1.1/',
            'content': 'http://purl.org/rss/1.0/modules/content/'
        }
        
        items = root.findall('.//item')
        news = []
        
        for item in items[:5]:  # 每个源最多5条
            title_elem = item.find('title')
            link_elem = item.find('link')
            desc_elem = item.find('description')
            date_elem = item.find('pubDate')
            
            if title_elem is not None and link_elem is not None:
                title = title_elem.text or ''
                link = link_elem.text or ''
                desc = (desc_elem.text or '').replace('<![CDATA[', '').replace(']]>', '').strip()
                pub_date = date_elem.text if date_elem is not None else datetime.now().isoformat()
                
                # 清理HTML标签
                desc = re.sub(r'<[^>]+>', '', desc)
                
                news.append({
                    'title': title.strip(),
                    'link': link.strip(),
                    'description': desc[:200] if desc else '',
                    'pubDate': pub_date,
                    'formattedDate': format_date(pub_date),
                    'source': source_name
                })
        
        return news
    except Exception as e:
        print(f"获取 {source_name} 失败: {e}")
        return []

def format_date(date_str):
    """格式化日期字符串为中文格式
    
    Args:
        date_str: 日期字符串
        
    Returns:
        str: 格式化后的日期字符串（格式：YYYY年MM月DD日 HH:MM）
    """
    try:
        if date_parser:
            dt = date_parser.parse(date_str)
            return dt.strftime('%Y年%m月%d日 %H:%M')
        else:
            # 如果没有dateutil，尝试简单解析
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.strftime('%Y年%m月%d日 %H:%M')
    except Exception:
        return datetime.now().strftime('%Y年%m月%d日 %H:%M')

def fetch_news():
    """从所有配置的新闻源获取新闻
    
    Returns:
        list: 最新20条新闻，按日期倒序排列
    """
    all_news = []
    
    for source in NEWS_SOURCES:
        print(f"正在获取 {source['name']}...")
        news = parse_rss(source['url'], source['name'])
        all_news.extend(news)
        
        # 避免请求过快
        time.sleep(1)
    
    # 按日期排序
    all_news.sort(key=lambda x: x.get('pubDate', ''), reverse=True)
    
    return all_news[:20]  # 返回最新20条

def fetch_movies():
    """从TMDB API获取热门法语电影和剧集
    
    需要设置环境变量 TMDB_API_KEY
    
    Returns:
        list: 电影和剧集列表，每个条目包含id, title, overview等字段
    """
    api_key = os.getenv('TMDB_API_KEY')
    
    if not api_key:
        print("警告: 未设置 TMDB_API_KEY，跳过电影数据更新")
        return []
    
    try:
        # 获取热门电影
        movies_url = f'https://api.themoviedb.org/3/movie/popular?api_key={api_key}&language=fr-FR&page=1'
        response = requests.get(movies_url, timeout=10)
        response.raise_for_status()
        movies_data = response.json()
        
        movies = []
        for movie in movies_data.get('results', [])[:10]:
            if movie.get('vote_average', 0) >= 6.5:
                movies.append({
                    'id': movie['id'],
                    'title': movie.get('title', ''),
                    'original_title': movie.get('original_title', ''),
                    'overview': movie.get('overview', ''),
                    'poster_path': movie.get('poster_path', ''),
                    'release_date': movie.get('release_date', ''),
                    'vote_average': movie.get('vote_average', 0),
                    'type': 'movie'
                })
        
        # 获取热门剧集
        tv_url = f'https://api.themoviedb.org/3/tv/popular?api_key={api_key}&language=fr-FR&page=1'
        response = requests.get(tv_url, timeout=10)
        response.raise_for_status()
        tv_data = response.json()
        
        for tv in tv_data.get('results', [])[:10]:
            if tv.get('vote_average', 0) >= 6.5:
                movies.append({
                    'id': tv['id'],
                    'title': tv.get('name', ''),
                    'original_title': tv.get('original_name', ''),
                    'overview': tv.get('overview', ''),
                    'poster_path': tv.get('poster_path', ''),
                    'release_date': tv.get('first_air_date', ''),
                    'vote_average': tv.get('vote_average', 0),
                    'type': 'tv'
                })
        
        return movies
    except Exception as e:
        print(f"获取电影数据失败: {e}")
        return []

def main():
    """主函数：更新新闻和电影数据并保存为JSON文件"""
    print("=" * 50)
    print("开始更新数据...")
    print("=" * 50)
    
    # 更新新闻
    print("\n[1/2] 更新新闻数据...")
    news = fetch_news()
    news_file = DATA_DIR / 'news.json'
    with open(news_file, 'w', encoding='utf-8') as f:
        json.dump({
            'updated_at': datetime.now().isoformat(),
            'count': len(news),
            'news': news
        }, f, ensure_ascii=False, indent=2)
    print(f"✓ 已更新 {len(news)} 条新闻到 {news_file}")
    
    # 更新电影
    print("\n[2/2] 更新电影数据...")
    movies = fetch_movies()
    movies_file = DATA_DIR / 'movies.json'
    with open(movies_file, 'w', encoding='utf-8') as f:
        json.dump({
            'updated_at': datetime.now().isoformat(),
            'count': len(movies),
            'movies': movies
        }, f, ensure_ascii=False, indent=2)
    print(f"✓ 已更新 {len(movies)} 部影视到 {movies_file}")
    
    print("\n" + "=" * 50)
    print("数据更新完成！")
    print("=" * 50)

if __name__ == '__main__':
    main()

