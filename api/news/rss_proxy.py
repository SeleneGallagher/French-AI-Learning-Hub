"""
RSS代理API - 后端代理RSS请求，解决CORS问题
"""
import os
import json
import requests
from lib.utils import json_response

def handler(request):
    """代理RSS请求"""
    # 获取请求方法
    if isinstance(request, dict):
        method = request.get('httpMethod', 'GET')
    else:
        method = getattr(request, 'method', None) or getattr(request, 'httpMethod', None) or 'GET'
    method = method.upper() if method else 'GET'
    
    # 处理 CORS 预检请求
    if method == 'OPTIONS':
        return json_response({}, 200)
    
    if method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        # 获取RSS URL参数
        if isinstance(request, dict):
            query_params = request.get('queryStringParameters') or {}
            rss_url = query_params.get('url', '')
        elif hasattr(request, 'args'):
            rss_url = request.args.get('url', '')
        else:
            rss_url = ''
        
        if not rss_url:
            return json_response({'success': False, 'message': '缺少url参数'}, 400)
        
        # 验证URL格式
        if not rss_url.startswith('http://') and not rss_url.startswith('https://'):
            return json_response({'success': False, 'message': '无效的URL格式'}, 400)
        
        # 只允许特定的RSS源（安全限制）
        allowed_domains = [
            'france24.com',
            'lemonde.fr',
            'rfi.fr',
            'franceinfo.fr',
            '20minutes.fr'
        ]
        
        from urllib.parse import urlparse
        parsed = urlparse(rss_url)
        if not any(domain in parsed.netloc for domain in allowed_domains):
            return json_response({'success': False, 'message': '不允许的RSS源'}, 403)
        
        # 代理请求RSS
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
        
        response = requests.get(rss_url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return json_response({
                'success': False,
                'message': f'RSS请求失败: {response.status_code}'
            }, response.status_code)
        
        # 返回RSS内容
        return json_response({
            'success': True,
            'content': response.text,
            'contentType': response.headers.get('Content-Type', 'application/xml')
        }, 200)
        
    except requests.exceptions.Timeout:
        return json_response({'success': False, 'message': 'RSS请求超时'}, 504)
    except requests.exceptions.RequestException as e:
        return json_response({'success': False, 'message': f'RSS请求失败: {str(e)}'}, 500)
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)

