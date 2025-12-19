"""
Flask后端应用 - 用于国内服务器部署
将Vercel Serverless Functions转换为Flask应用
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 导入API处理函数
try:
    from api.auth.login import handler as login_handler
    from api.auth.register import handler as register_handler
    from api.news.list import handler as news_handler
    from api.movies.list import handler as movies_handler
    from api.dictionary.history import handler as dict_handler
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
                return jsonify(eval(result['body'])), result['statusCode']
            elif isinstance(result, dict):
                return jsonify(result), 200
            else:
                return result
        except Exception as e:
            print(f"API错误: {e}")
            return jsonify({'success': False, 'message': str(e)}), 500
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

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'French AI Learning Hub Backend'})

if __name__ == '__main__':
    # 开发环境
    app.run(host='127.0.0.1', port=5000, debug=True)
else:
    # 生产环境使用gunicorn
    pass

