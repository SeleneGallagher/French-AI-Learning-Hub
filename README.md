# 🇫🇷 French AI Learning Hub

一个功能丰富的法语学习平台，集成了新闻阅读、影视推荐、词典查询、语用积累和AI助手等功能。

## ✨ 主要功能

### 📰 实时新闻资讯
- 自动抓取法国主流媒体最新新闻（France 24、Le Monde、RFI等）
- 支持关键词提取和翻译
- 新闻列表实时更新

### 🎬 热门影视推荐
- 推荐高质量法语电影和剧集
- 显示评分、简介、海报等信息
- 支持"想看"列表管理
- 自动翻译剧情简介

### 📖 法语词典
- **词典查询**：快速搜索法语词汇（支持完整 Wiktionary 词典）
- **历史记录**：自动保存查询历史，支持跨设备同步
- **收藏夹**：收藏常用单词
- **背单词**：智能学习系统
  - 随机单词学习
  - 复习生疏单词
  - 已学列表管理
  - 熟练度标记（生疏/模糊/熟练）

### 💬 语用积累
- 学习常用法语表达和短语
- AI生成情景对话
- 收藏喜欢的表达

### 🤖 AI助手
- 基于Coze平台的智能对话
- 支持法语学习相关问题
- 流式响应，体验流畅

## 🚀 快速开始

### 环境要求

- Python 3.11+（用于后端服务）
- PostgreSQL（用于数据存储，可选）
- 现代浏览器（Chrome、Firefox、Edge等）

### 本地运行

**Windows用户：**
```bash
双击运行 start.bat
```

**Mac/Linux用户：**
```bash
# 确保在项目根目录
cd /path/to/AI_LL

# 给脚本添加执行权限（首次使用）
chmod +x start.sh

# 运行启动脚本
./start.sh
```

**或者直接使用命令：**
```bash
# Python 3
python3 -m http.server 8000

# 或使用 Flask 服务器（支持后端API）
python start_server.py
```

然后在浏览器打开：`http://localhost:8000`

> **注意**：必须在项目根目录（包含 `index.html` 的目录）下启动服务器！

## ⚙️ 配置

### 环境变量配置

**快速设置**：
1. 复制 `env.example` 为 `.env`
2. 根据需要配置环境变量（所有变量都是可选的）

**必需变量（部署时）：**
- `DATABASE_URL` - PostgreSQL 数据库连接URL（Railway会自动设置）
- `JWT_SECRET` - JWT签名密钥（用于用户认证）

**可选变量：**
- `COZE_BOT_ID` - Coze机器人ID（AI助手功能）
- `COZE_PAT_TOKEN` - Coze访问令牌
- `COZE_SAT_TOKEN` - Coze系统令牌（备选）
- `DEEPSEEK_API_KEY` - DeepSeek API密钥（新闻关键词、语用生成）
- `TMDB_API_KEY` - TMDB API密钥（电影数据）


**生成 JWT_SECRET：**
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
python -c "import secrets; print(secrets.token_hex(32))"
```

### 词典数据导入（可选）

项目支持使用 [French-Dictionary](https://github.com/hbenbel/French-Dictionary) 提供的完整法语词典数据。

**使用步骤：**
1. 下载或克隆 French-Dictionary 仓库：
   ```bash
   git clone https://github.com/hbenbel/French-Dictionary.git
   ```
2. 将 `dictionary` 文件夹复制到项目根目录（或放在项目同级目录）
3. 运行导入工具生成 JSON 文件：
   ```bash
   python scripts/tools/import_french_dict.py
   ```
4. 生成的词典文件（8个JSON文件，总计约208MB）会自动被词典模块加载

**注意：** 
- French-Dictionary 使用 MIT License，使用时请保留原始许可证文件（项目已包含 `LICENSE-French-Dictionary`）
- 词典文件较大，已添加到 `.gitignore`，需要在本地生成
- 导入工具会保留所有原始信息：词性、性别、变位、标签等
- 词典文件存储在 `public/data/dicts/` 目录，通过静态文件服务提供

## 📁 项目结构

```
AI_LL/
├── api/                    # 后端 API 模块
│   ├── ai/                # AI 相关（Coze、DeepSeek）
│   ├── auth/              # 用户认证（登录/注册）
│   ├── dictionary/        # 词典相关
│   ├── movies/            # 电影数据
│   ├── news/              # 新闻数据
│   └── config.py          # 配置 API
│
├── database/              # 数据库
│   ├── init.sql          # PostgreSQL 初始化脚本
│   └── init_db.py        # 数据库初始化工具
│
├── docs/                  # 文档目录
│   └── 环境变量清单.md    # 环境变量详细说明（可选）
│
├── lib/                   # 共享库
│   └── utils.py          # 工具函数（数据库、JWT）
│
├── scripts/               # 前端脚本
│   ├── modules/          # 功能模块
│   ├── services/         # 服务层
│   ├── utils/           # 工具函数
│   └── app.js           # 主入口
│
├── public/               # 静态资源
│   └── data/            # 数据文件（词典、新闻、电影）
│
├── app.py                # Flask 应用主文件
├── index.html            # 前端主页面
│
├── requirements.txt      # Python 依赖（开发）
├── requirements_server.txt # Python 依赖（生产）
├── Procfile              # Railway 启动配置
├── railway.json          # Railway 配置
└── Dockerfile            # Docker 配置
```

详细结构说明请查看：[项目结构说明](./docs/项目结构说明.md)

## 🛠️ 技术栈

- **前端**：原生JavaScript (ES6+)、Tailwind CSS
- **后端**：Python Flask
- **数据库**：PostgreSQL（用户数据、同步功能）
- **存储**：LocalStorage、IndexedDB（本地数据）
- **AI服务**：DeepSeek API、Coze API
- **部署**：Railway、Docker

## 📝 使用说明

### 词典模块
1. 在搜索框输入法语单词
2. 查看详细释义、例句、词性等信息
3. 点击"收藏"保存常用单词
4. 使用"背单词"功能进行系统学习

### 新闻模块
- 自动加载最新新闻
- 点击新闻标题查看详情
- 使用关键词功能提取重点词汇

### 影视模块
- 浏览推荐的法语影视作品
- 点击"想看"添加到列表
- 查看详细信息和评分

## 🌐 部署

### 🚂 Railway 部署（推荐）⭐

**快速部署步骤：**

1. **访问 Railway Dashboard**
   - 打开 https://railway.app
   - 使用 GitHub 登录
   - 选择 "Deploy from GitHub repo"
   - 选择你的仓库

2. **添加 PostgreSQL 数据库**
   - 点击 **"New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway 会自动设置 `DATABASE_URL` 环境变量

3. **设置环境变量**
   - 在 Railway Dashboard → Variables 中添加：
     - `JWT_SECRET` - JWT 签名密钥（必需）
     - `COZE_BOT_ID`、`COZE_PAT_TOKEN` 等（可选，AI 功能）

4. **初始化数据库**
   - 使用 Python 脚本（推荐）：
     ```bash
     # 设置数据库连接
     $env:DATABASE_URL="postgresql://postgres:密码@主机:5432/railway"
     
     # 运行初始化脚本
     python database/init_db.py
     ```
   - 或使用 DBeaver 等数据库工具执行 `database/init.sql`

5. **等待部署完成**
   - Railway 会自动构建和部署
   - 2-5 分钟后即可访问


### 云服务器部署

```bash
# 1. 上传项目到服务器
scp -r /path/to/AI_LL root@服务器IP:/var/www/

# 2. 安装依赖
cd /var/www/AI_LL
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements_server.txt

# 3. 配置环境变量
cp env.example .env
nano .env  # 编辑环境变量

# 4. 初始化数据库
python database/init_db.py

# 5. 启动服务（使用 gunicorn）
gunicorn app:app --bind 127.0.0.1:5000 --workers 2

# 6. 配置 Nginx 反向代理
# 7. 设置定时任务更新数据
crontab -e
# 添加：0 */6 * * * cd /var/www/AI_LL && python3 scripts/server/update_data.py
```


## 🔧 数据更新

### 手动更新

```bash
python3 scripts/server/update_data.py
```

### 定时更新（服务器）

使用 crontab 设置定时任务：

```bash
# 每6小时更新一次
0 */6 * * * cd /path/to/AI_LL && python3 scripts/server/update_data.py
```

## 📄 许可证

本项目仅供学习使用。

词典数据来源于 [French-Dictionary](https://github.com/hbenbel/French-Dictionary)，使用 MIT License。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受你的法语学习之旅！** 🇫🇷
