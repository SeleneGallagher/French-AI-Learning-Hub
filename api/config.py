"""
获取前端配置API
返回前端需要的配置信息（不包含敏感密钥）
"""
import os
import json
from lib.utils import json_response

def handler(request):
    """返回前端配置"""
    # 只返回是否配置了某些服务，不返回实际密钥
    config = {
        'coze': {
            'bot_id': os.environ.get('COZE_BOT_ID', ''),
            'api_base': 'https://api.coze.cn/v3',
            'has_token': bool(os.environ.get('COZE_PAT_TOKEN') or os.environ.get('COZE_SAT_TOKEN'))
        },
        'tmdb': {
            'has_key': bool(os.environ.get('TMDB_API_KEY'))
        },
        'deepseek': {
            'has_key': bool(os.environ.get('DEEPSEEK_API_KEY'))
        }
    }
    
    return json_response(config, 200)

