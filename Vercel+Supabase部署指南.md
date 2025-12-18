# Vercel + Supabase 完整部署指南

## 📋 目录
1. [项目结构改造](#项目结构改造)
2. [Supabase设置](#supabase设置)
3. [代码改造](#代码改造)
4. [GitHub上传](#github上传)
5. [Vercel部署](#vercel部署)

---

## 📦 项目结构改造

### 新的项目结构

```
AI_LL/
├── api/                          # Vercel Serverless Functions
│   ├── auth/
│   │   ├── login.py
│   │   ├── register.py
│   │   └── verify.py
│   ├── dictionary/
│   │   ├── history.py
│   │   ├── favorites.py
│   │   └── vocab-progress.py
│   ├── expressions/
│   │   ├── list.py
│   │   ├── create.py
│   │   └── favorites.py
│   ├── ai/
│   │   └── chat.py
│   ├── news/
│   │   └── list.py
│   └── movies/
│       └── list.py
│
├── public/                       # 前端静态文件
│   ├── index.html
│   ├── scripts/
│   ├── styles/
│   └── data/
│
├── vercel.json                   # Vercel配置
├── requirements.txt             # Python依赖
├── .env.example                  # 环境变量示例
└── .gitignore
```

---

## 🗄️ Supabase设置

### 1. 创建Supabase项目

1. 访问 https://supabase.com
2. 注册/登录账号
3. 点击 "New Project"
4. 填写项目信息：
   - Name: `french-ai-learning`
   - Database Password: （记住这个密码）
   - Region: 选择离你最近的区域
5. 等待项目创建完成（约2分钟）

### 2. 获取连接信息

创建完成后，在项目设置中找到：
- **Project URL**: `https://xxxxx.supabase.co`
- **anon key**: `eyJhbGc...`（公开密钥）
- **service_role key**: `eyJhbGc...`（服务密钥，保密）

### 3. 创建数据库表

在Supabase SQL Editor中执行：

```sql
-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- 注册码表
CREATE TABLE registration_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    used_by_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    unlimited_use BOOLEAN DEFAULT FALSE  -- 是否可无限使用
);

-- 词典查询历史
CREATE TABLE dict_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    searched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dict_history_user ON dict_history(user_id, searched_at DESC);

-- 词典收藏
CREATE TABLE dict_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    word_data TEXT,
    favorited_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, word)
);

-- 背单词进度
CREATE TABLE vocab_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    quality INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    last_review TIMESTAMP,
    next_review TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, word)
);

-- 语用表达记录
CREATE TABLE expressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,
    expression_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 语用表达收藏
CREATE TABLE expression_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expression_id UUID REFERENCES expressions(id) ON DELETE CASCADE,
    favorited_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, expression_id)
);

-- AI聊天记录
CREATE TABLE ai_chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(100),
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_user_conversation ON ai_chat_history(user_id, conversation_id);

-- 影视收藏
CREATE TABLE movie_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    movie_data TEXT,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

-- 插入无限使用的注册码（所有人都可以用，用后不失效）
INSERT INTO registration_codes (code, unlimited_use) VALUES 
    ('PUBLIC_CODE', TRUE);

-- 以后添加单次使用的注册码时，直接写（默认就是FALSE，不需要写unlimited_use）：
-- INSERT INTO registration_codes (code) VALUES ('SINGLE_USE_CODE');
```

### 4. 设置Row Level Security (RLS)

```sql
-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE expressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expression_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_favorites ENABLE ROW LEVEL SECURITY;

-- 注意：RLS策略需要在应用层通过service_role key绕过
-- 或者为每个用户创建策略（复杂）
-- 建议：在Serverless Functions中使用service_role key
```

---

## 🔧 代码改造

### 1. 创建vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/public/$1"
    }
  ]
}
```

### 2. 创建requirements.txt

```txt
supabase>=2.0.0
pyjwt>=2.8.0
bcrypt>=4.0.0
requests>=2.31.0
python-dateutil>=2.8.2
```

### 3. 创建API工具文件

**api/utils.py**:
```python
import os
import json
import jwt
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')  # 使用service_role key
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def verify_token(request):
    """验证JWT Token并返回user_id"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.replace('Bearer ', '')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except:
        return None

def json_response(data, status_code=200):
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(data, ensure_ascii=False)
    }
```

### 4. 创建注册API

**api/auth/register.py**:
```python
import json
import os
import jwt
import bcrypt
from api.utils import get_supabase, json_response

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def handler(request):
    if request.method != 'POST':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        reg_code = data.get('registration_code', '').strip()
        
        if not username or not password or not reg_code:
            return json_response({'success': False, 'message': '请填写所有字段'}, 400)
        
        supabase = get_supabase()
        
        # 验证注册码
        code_result = supabase.table('registration_codes')\
            .select('*')\
            .eq('code', reg_code)\
            .eq('is_active', True)\
            .is_('used_at', 'null')\
            .execute()
        
        if not code_result.data:
            return json_response({'success': False, 'message': '注册码无效'}, 400)
        
        # 检查用户名是否存在
        user_result = supabase.table('users')\
            .select('id')\
            .eq('username', username)\
            .execute()
        
        if user_result.data:
            return json_response({'success': False, 'message': '用户名已存在'}, 400)
        
        # 创建用户
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user_result = supabase.table('users')\
            .insert({
                'username': username,
                'password_hash': password_hash
            })\
            .execute()
        
        user = user_result.data[0]
        
        # 标记注册码为已使用
        supabase.table('registration_codes')\
            .update({
                'used_at': 'now()',
                'used_by_user_id': user['id']
            })\
            .eq('code', reg_code)\
            .execute()
        
        # 生成JWT Token
        token = jwt.encode(
            {'user_id': str(user['id'])},
            JWT_SECRET,
            algorithm='HS256'
        )
        
        return json_response({
            'success': True,
            'token': token,
            'user': {'id': str(user['id']), 'username': user['username']}
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)
```

### 5. 创建登录API

**api/auth/login.py**:
```python
import json
import os
import jwt
import bcrypt
from api.utils import get_supabase, json_response

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')

def handler(request):
    if request.method != 'POST':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return json_response({'success': False, 'message': '请填写用户名和密码'}, 400)
        
        supabase = get_supabase()
        
        # 查询用户
        user_result = supabase.table('users')\
            .select('*')\
            .eq('username', username)\
            .eq('is_active', True)\
            .execute()
        
        if not user_result.data:
            return json_response({'success': False, 'message': '用户名或密码错误'}, 401)
        
        user = user_result.data[0]
        
        # 验证密码
        if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
            return json_response({'success': False, 'message': '用户名或密码错误'}, 401)
        
        # 更新最后登录时间
        supabase.table('users')\
            .update({'last_login': 'now()'})\
            .eq('id', user['id'])\
            .execute()
        
        # 生成JWT Token
        token = jwt.encode(
            {'user_id': str(user['id'])},
            JWT_SECRET,
            algorithm='HS256'
        )
        
        return json_response({
            'success': True,
            'token': token,
            'user': {'id': str(user['id']), 'username': user['username']}
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)
```

### 6. 创建新闻代理API

**api/news/list.py**:
```python
import json
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from api.utils import json_response

NEWS_SOURCES = [
    'https://www.france24.com/fr/rss',
    'https://www.lemonde.fr/rss/une.xml',
    'https://www.franceinfo.fr/rss',
    'https://www.20minutes.fr/rss/une.xml',
    'https://www.rfi.fr/fr/rss'
]

def handler(request):
    if request.method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    try:
        all_news = []
        
        for rss_url in NEWS_SOURCES[:3]:  # 限制3个源
            try:
                # 服务器可以访问外网
                response = requests.get(rss_url, timeout=10, headers={
                    'User-Agent': 'Mozilla/5.0'
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
                            all_news.append({
                                'title': title.text or '',
                                'link': link.text or '',
                                'description': (desc.text or '').replace('<[^>]*>', '')[:200],
                                'source': rss_url.split('/')[2].replace('www.', ''),
                                'pubDate': pub_date.text if pub_date is not None else datetime.now().isoformat()
                            })
            except:
                continue
        
        return json_response({
            'success': True,
            'data': all_news[:10]  # 最多10条
        })
        
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)
```

### 7. 创建电影代理API

**api/movies/list.py**:
```python
import json
import os
import requests
from api.utils import json_response

TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '')

def handler(request):
    if request.method != 'GET':
        return json_response({'success': False, 'message': 'Method not allowed'}, 405)
    
    if not TMDB_API_KEY:
        return json_response({'success': False, 'message': 'TMDB API Key未配置'}, 500)
    
    try:
        # 服务器代理TMDB API
        url = f'https://api.themoviedb.org/3/discover/movie'
        params = {
            'api_key': TMDB_API_KEY,
            'language': 'fr-FR',
            'with_original_language': 'fr',
            'sort_by': 'popularity.desc',
            'vote_average.gte': 6.5,
            'page': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.ok:
            data = response.json()
            return json_response({
                'success': True,
                'data': data.get('results', [])[:20]
            })
        else:
            return json_response({'success': False, 'message': 'TMDB API错误'}, 500)
            
    except Exception as e:
        return json_response({'success': False, 'message': str(e)}, 500)
```

---

## 📝 前端改造

### 1. 创建API服务

**scripts/services/apiService.js**:
```javascript
const API_BASE = '/api';

export class APIService {
    static getToken() {
        return localStorage.getItem('auth_token');
    }
    
    static async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.hash = '#login';
            throw new Error('请重新登录');
        }
        
        const data = await response.json();
        if (!data.success && data.message) {
            throw new Error(data.message);
        }
        
        return data;
    }
    
    // 认证
    static async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }
    
    static async register(username, password, registrationCode) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, registration_code: registrationCode })
        });
    }
    
    // 新闻
    static async getNews() {
        return this.request('/news/list');
    }
    
    // 电影
    static async getMovies() {
        return this.request('/movies/list');
    }
    
    // 词典
    static async getDictHistory() {
        return this.request('/dictionary/history');
    }
    
    static async addDictHistory(word) {
        return this.request('/dictionary/history', {
            method: 'POST',
            body: JSON.stringify({ word })
        });
    }
    
    // ... 其他API方法
}
```

### 2. 改造新闻模块

**scripts/modules/news.js** (修改):
```javascript
import { APIService } from '../services/apiService.js';
// ... 其他导入

export async function initNews() {
    // ... 现有代码
    
    try {
        showLoading(loadingEl);
        errorEl.classList.add('hidden');
        
        // 改为调用后端API
        const response = await APIService.getNews();
        const news = response.data || [];
        
        currentNews = news;
        renderNews(news);
        hideLoading(loadingEl);
    } catch (error) {
        // ... 错误处理
    }
}
```

### 3. 改造电影模块

**scripts/modules/movies.js** (修改):
```javascript
import { APIService } from '../services/apiService.js';
// ... 其他导入

// 修改fetchFromTMDB函数
async function fetchFromTMDB(endpoint) {
    try {
        // 改为调用后端API
        const response = await APIService.getMovies();
        return response.data || [];
    } catch (error) {
        console.error('获取电影失败:', error);
        return [];
    }
}
```

---

## 📤 GitHub上传

### 1. 初始化Git仓库

```bash
# 在项目根目录
git init
git add .
git commit -m "Initial commit: Vercel + Supabase setup"
```

### 2. 创建GitHub仓库

1. 访问 https://github.com
2. 点击 "New repository"
3. 填写仓库名：`french-ai-learning`
4. 选择 Public 或 Private
5. **不要**勾选 "Initialize with README"
6. 点击 "Create repository"

### 3. 推送到GitHub

```bash
# 添加远程仓库（替换YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/french-ai-learning.git

# 推送代码
git branch -M main
git push -u origin main
```

---

## 🚀 Vercel部署

### 1. 连接GitHub

1. 访问 https://vercel.com
2. 使用GitHub账号登录
3. 点击 "Add New Project"
4. 选择你的GitHub仓库 `french-ai-learning`
5. 点击 "Import"

### 2. 配置项目

**Framework Preset**: Other
**Root Directory**: `./` (默认)
**Build Command**: (留空)
**Output Directory**: `public` (前端文件)

### 3. 设置环境变量

在Vercel项目设置中添加：

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc... (service_role key)
JWT_SECRET=your-random-secret-key-here
DEEPSEEK_API_KEY=sk-...
COZE_BOT_ID=...
COZE_ACCESS_TOKEN=...
TMDB_API_KEY=...
```

### 4. 部署

点击 "Deploy"，等待部署完成（约2-3分钟）

### 5. 访问

部署完成后，Vercel会给你一个URL：
`https://your-project.vercel.app`

---

## ✅ 检查清单

- [ ] Supabase项目已创建
- [ ] 数据库表已创建
- [ ] 注册码已插入
- [ ] 项目结构已改造
- [ ] API代码已创建
- [ ] 前端代码已改造
- [ ] 代码已推送到GitHub
- [ ] Vercel项目已创建
- [ ] 环境变量已配置
- [ ] 部署成功
- [ ] 测试访问

---

## 🎯 总结

1. **项目结构**：创建`api/`目录存放Serverless Functions
2. **Supabase**：创建数据库和表
3. **代码改造**：前端调用后端API，后端代理外网API
4. **GitHub**：推送代码到仓库
5. **Vercel**：连接GitHub，配置环境变量，部署

**完成！** 🚀


