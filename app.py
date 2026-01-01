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

# 全局错误处理器，确保所有错误都返回JSON
@app.errorhandler(500)
def internal_error(error):
    response = jsonify({
        'success': False,
        'message': str(error) if error else 'Internal Server Error',
        'type': 'server_error'
    })
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Content-Type'] = 'application/json'
    return response, 500

@app.errorhandler(404)
def not_found(error):
    response = jsonify({
        'success': False,
        'message': 'Not Found',
        'type': 'not_found'
    })
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Content-Type'] = 'application/json'
    return response, 404

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
    try:
        from api.dictionary.history import handler as dict_handler
    except ImportError as dict_error:
        print(f"警告: 无法导入 dictionary.history: {dict_error}")
        dict_handler = None
    from api.config import handler as config_handler
    from api.ai.coze import handler as coze_handler
    from api.ai.deepseek import handler as deepseek_handler
    try:
        from api.admin.users import handler as admin_users_handler
        from api.admin.registration_codes import handler as admin_codes_handler
    except ImportError as admin_error:
        print(f"警告: 无法导入 admin模块: {admin_error}")
        admin_users_handler = None
        admin_codes_handler = None
except ImportError as import_error:
    import traceback
    traceback.print_exc()
    error_msg = str(import_error)
    print(f"警告: 无法导入某些模块: {error_msg}")
    # 创建占位函数（使用闭包捕获错误信息）
    def create_placeholder_handler(error_details):
        def placeholder_handler(request):
            return {'statusCode': 500, 'body': json.dumps({'success': False, 'error': 'Handler not loaded', 'details': error_details})}
        return placeholder_handler
    placeholder_handler = create_placeholder_handler(error_msg)
    login_handler = register_handler = news_handler = movies_handler = dict_handler = config_handler = placeholder_handler
    coze_handler = deepseek_handler = placeholder_handler
    admin_users_handler = placeholder_handler

# 适配函数：将Flask request转换为Vercel格式
class VercelRequest:
    def __init__(self, flask_request):
        self.method = flask_request.method
        self.headers = flask_request.headers
        self._json = flask_request.get_json(silent=True)
        self.form = flask_request.form
        self.args = flask_request.args
        self._flask_request = flask_request
    
    def get_json(self):
        """提供get_json方法以兼容Flask格式"""
        return self._json
    
    @property
    def json(self):
        """提供json属性"""
        return self._json
    
    @property
    def body(self):
        """提供body属性，返回JSON字符串"""
        if self._json:
            import json
            return json.dumps(self._json)
        return ''
    
    @property
    def queryStringParameters(self):
        """提供queryStringParameters属性，用于获取URL参数"""
        return dict(self.args)

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
        except json.JSONDecodeError as e:
            error_response = {
                'success': False,
                'message': f'JSON解析错误: {str(e)}',
                'type': 'json_error'
            }
            response = jsonify(error_response)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Content-Type'] = 'application/json'
            return response, 400
        except Exception as e:
            import traceback
            error_msg = str(e)
            traceback.print_exc()
            # 确保错误信息是JSON格式，而不是HTML
            error_response = {
                'success': False,
                'message': error_msg,
                'type': type(e).__name__,
                'error': error_msg
            }
            response = jsonify(error_response)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Content-Type'] = 'application/json'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
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

@app.route('/api/movies/tmdb/<path:endpoint>', methods=['GET', 'OPTIONS'])
def movies_tmdb(endpoint):
    """TMDB API代理"""
    if request.method == 'OPTIONS':
        return '', 200
    from api.movies.tmdb import handler as tmdb_handler
    # 构建完整的endpoint路径（包含查询参数）
    full_endpoint = f'/{endpoint}'
    if request.query_string:
        full_endpoint += f'?{request.query_string.decode()}'
    
    # 将endpoint添加到request中
    class RequestWrapper:
        def __init__(self, original_request, endpoint_path):
            # 复制所有属性
            for attr in dir(original_request):
                if not attr.startswith('_'):
                    try:
                        setattr(self, attr, getattr(original_request, attr))
                    except:
                        pass
            # 确保endpoint_path被设置
            self.endpoint_path = endpoint_path
            # 确保args被正确传递（用于queryStringParameters）
            if hasattr(original_request, 'args'):
                self.args = original_request.args
    
    # 创建VercelRequest包装器
    vercel_request = VercelRequest(request)
    wrapped_request = RequestWrapper(vercel_request, full_endpoint)
    return adapt_handler(tmdb_handler)(wrapped_request)

@app.route('/api/dictionary/history', methods=['GET', 'POST', 'OPTIONS'])
def dictionary_history():
    if request.method == 'OPTIONS':
        return '', 200
    if dict_handler is None:
        return jsonify({'success': False, 'message': 'Dictionary handler not loaded'}), 500
    return adapt_handler(dict_handler)()

@app.route('/api/user/sync', methods=['GET', 'POST', 'OPTIONS'])
def user_sync():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        from api.user import sync
        return adapt_handler(sync.handler)()
    except ImportError as e:
        return jsonify({
            'success': False,
            'message': f'User sync handler not loaded: {str(e)}'
        }), 500

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

@app.route('/api/admin/users', methods=['GET', 'OPTIONS'])
def admin_users():
    if request.method == 'OPTIONS':
        return '', 200
    if admin_users_handler:
        return adapt_handler(admin_users_handler)()
    else:
        return jsonify({'success': False, 'message': 'Admin handler not loaded'}), 500

@app.route('/api/admin/registration-codes', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def admin_codes():
    if request.method == 'OPTIONS':
        return '', 200
    if admin_codes_handler:
        return adapt_handler(admin_codes_handler)()
    else:
        return jsonify({'success': False, 'message': 'Admin codes handler not loaded'}), 500

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

