"""
新闻列表API - 代理RSS源
"""
import json
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from lib.utils import json_response

NEWS_SOURCES = [
    'https://www.france24.com/fr/rss',
    'https://www.lemonde.fr/rss/une.xml',
    'https://www.franceinfo.fr/rss',
    'https://www.20minutes.fr/rss/une.xml',
    'https://www.rfi.fr/fr/rss'
]

def handler(request):
    # 处理 CORS 预检请求
    if request.method == 'OPTIONS':
        return json_response({}, 200)
    
    if request.method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        all_news = []
        
        for rss_url in NEWS_SOURCES[:3]:  # 限制3个源
            try:
                # 服务器可以访问外网
                response = requests.get(rss_url, timeout=10, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                
                if response.ok:
                    root = ET.fromstring(response.content)
                    items = root.findall('.//item')[:3]  # 每个源3条
                    
                    for item in items:
                        title = item.find('title')
                        link = item.find('link')
                        desc = item.find('description')
                        pub_date = item.find('pubDate')
                        
                        if title is not None and link is not None:
                            # 清理描述中的HTML标签
                            description = (desc.text or '').replace('<[^>]*>', '')[:200] if desc is not None else ''
                            
                            all_news.append({
                                'title': title.text or '',
                                'link': link.text or '',
                                'description': description,
                                'source': rss_url.split('/')[2].replace('www.', '').split('.')[0],
                                'pubDate': pub_date.text if pub_date is not None else datetime.now().isoformat(),
                                'formattedDate': format_date(pub_date.text if pub_date is not None else datetime.now().isoformat())
                            })
            except Exception as e:
                print(f"Error fetching {rss_url}: {e}")
                continue
        
        return json_response({
            'success': True,
            'data': all_news[:10]  # 最多10条
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)

def format_date(date_str):
    """格式化日期"""
    try:
        from dateutil import parser
        dt = parser.parse(date_str)
        return dt.strftime('%Y-%m-%d %H:%M')
    except:
        return date_str


