"""
Flask后端应用 - 用于国内服务器部署
将Vercel Serverless Functions转换为Flask应用
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

# 添加 public 目录到静态文件路径
import os
from flask import send_from_directory

@app.route('/public/<path:filename>')
def public_files(filename):
    """提供 public 目录下的静态文件"""
    try:
        return send_from_directory('public', filename)
    except Exception as e:
        print(f"静态文件错误: {e}, 文件: {filename}")
        return jsonify({'error': 'File not found'}), 404
CORS(app)  # 允许跨域请求

# 导入API处理函数
try:
    from api.auth.login import handler as login_handler
    from api.auth.register import handler as register_handler
    from api.news.list import handler as news_handler
    from api.news.rss_proxy import handler as rss_proxy_handler
    from api.movies.list import handler as movies_handler
    from api.dictionary.history import handler as dict_handler
    from api.ai.coze import handler as coze_handler
    from api.ai.deepseek import handler as deepseek_handler
    from api.config import handler as config_handler
except ImportError as e:
    print(f"警告: 无法导入某些模块: {e}")

# 适配函数：将Flask request转换为Vercel格式
class VercelRequest:
    def __init__(self, flask_request):
        self.method = flask_request.method
        self.headers = flask_request.headers
        self.json = flask_request.get_json(silent=True)
        self.form = flask_request.form
        self.args = flask_request.args

def adapt_handler(handler_func):
    """适配Vercel handler为Flask路由"""
    def wrapper():
        vercel_request = VercelRequest(request)
        try:
            result = handler_func(vercel_request)
            # 如果返回的是字典，转换为Flask响应
            if isinstance(result, dict) and 'statusCode' in result:
                # 安全地解析JSON body
                body = result.get('body', '{}')
                if isinstance(body, str):
                    try:
                        body_data = json.loads(body)
                    except:
                        body_data = {'message': body}
                else:
                    body_data = body
                status_code = result.get('statusCode', 200)
                response = jsonify(body_data)
                response.headers['Access-Control-Allow-Origin'] = '*'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                return response, status_code
            elif isinstance(result, dict):
                response = jsonify(result)
                response.headers['Access-Control-Allow-Origin'] = '*'
                return response, 200
            else:
                return result
        except Exception as e:
            import traceback
            error_msg = str(e)
            traceback.print_exc()
            response = jsonify({'success': False, 'message': error_msg, 'type': type(e).__name__})
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response, 500
    wrapper.__name__ = handler_func.__name__
    return wrapper

# 定义路由
@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(login_handler)()

@app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(register_handler)()

@app.route('/api/news/list', methods=['GET', 'OPTIONS'])
def news_list():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(news_handler)()

@app.route('/api/news/rss_proxy', methods=['GET', 'OPTIONS'])
def rss_proxy():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(rss_proxy_handler)()

@app.route('/api/movies/list', methods=['GET', 'OPTIONS'])
def movies_list():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(movies_handler)()

@app.route('/api/dictionary/history', methods=['GET', 'POST', 'OPTIONS'])
def dictionary_history():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(dict_handler)()

@app.route('/api/ai/coze', methods=['POST', 'OPTIONS'])
def coze():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(coze_handler)()

@app.route('/api/ai/deepseek', methods=['POST', 'OPTIONS'])
def deepseek():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(deepseek_handler)()

@app.route('/api/config', methods=['GET', 'OPTIONS'])
def config():
    if request.method == 'OPTIONS':
        return '', 200
    return adapt_handler(config_handler)()

# 静态文件路由
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    """提供静态文件服务"""
    if not path:
        return app.send_static_file('index.html')
    # 排除API路由
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    try:
        # 处理 public/ 路径（使用专门的public路由）
        if path.startswith('public/'):
            # 移除 'public/' 前缀，使用send_from_directory
            file_path = path[7:]  # 移除 'public/' 前缀
            return send_from_directory('public', file_path)
        return app.send_static_file(path)
    except Exception as e:
        # SPA路由回退到index.html
        if '.' not in path.split('/')[-1]:  # 没有扩展名，可能是前端路由
            return app.send_static_file('index.html')
        return jsonify({'error': 'Not found', 'path': path, 'message': str(e)}), 404

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'French AI Learning Hub Backend'})

if __name__ == '__main__':
    # 开发环境
    app.run(host='127.0.0.1', port=5000, debug=True)
else:
    # 生产环境使用gunicorn
    pass

