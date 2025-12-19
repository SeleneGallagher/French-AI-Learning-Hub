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
- **历史记录**：自动保存查询历史
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

- Python 3.6+（用于本地服务器）
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

# 或 Python 2
python -m SimpleHTTPServer 8000
```

然后在浏览器打开：`http://localhost:8000`

> **注意**：必须在项目根目录（包含 `index.html` 的目录）下启动服务器！

## ⚙️ 配置

### API密钥配置（可选）

1. 复制 `config.example.js` 为 `config.js`
2. 根据需要配置以下API密钥：

#### 词典数据导入（可选）

项目支持使用 [French-Dictionary](https://github.com/hbenbel/French-Dictionary) 提供的完整法语词典数据。

**使用步骤：**
1. 下载或克隆 French-Dictionary 仓库：
   ```bash
   git clone https://github.com/hbenbel/French-Dictionary.git
   ```
2. 将 `dictionary` 文件夹复制到项目根目录（或放在项目同级目录）
3. 运行导入工具：
   ```bash
   python scripts/tools/import_french_dict.py
   ```
4. 生成的 `french_dict.json`（约180MB）会自动被词典模块加载

**注意：** 
- French-Dictionary 使用 MIT License，使用时请保留原始许可证文件（项目已包含 `LICENSE-French-Dictionary`）
- `french_dict.json` 文件较大，已添加到 `.gitignore`，需要在本地生成
- 导入工具会保留所有原始信息：词性、性别、变位、标签等

#### DeepSeek API（可选）
- **用途**：新闻关键词生成、语用表达生成
- **获取**：访问 https://platform.deepseek.com/api_keys
- **配置**：在 `config.js` 中添加 `deepseek_api_key`

#### TMDB API（可选）
- **用途**：电影数据和海报
- **获取**：访问 https://www.themoviedb.org/settings/api
- **配置**：在服务器 `.env` 文件中设置 `TMDB_API_KEY`

#### Coze API（可选）
- **用途**：AI助手对话
- **获取**：访问 https://www.coze.cn/ 创建机器人
- **配置**：在 `config.js` 中配置 `bot_id` 和 `access_token`

> **提示**：所有 API Key 都是可选的，不配置也能使用基础功能。不要将 `config.js` 提交到 Git。

### 词典导入

项目支持使用 [French-Dictionary](https://github.com/hbenbel/French-Dictionary) 词典：

```bash
# 1. 下载 French-Dictionary 并复制 dictionary 文件夹到项目根目录
git clone https://github.com/hbenbel/French-Dictionary.git
cp -r French-Dictionary/dictionary ./dictionary

# 2. 运行导入脚本
python3 scripts/tools/import_french_dict.py
```

导入后的词典文件将保存在 `public/data/dicts/french_dict.json`。

## 📁 项目结构

```
AI_LL/
├── index.html              # 主页面
├── config.example.js       # 配置文件示例
├── config.js               # 配置文件（需自行创建）
├── start.bat               # Windows启动脚本
├── start.sh                # Mac/Linux启动脚本
│
├── scripts/                # JavaScript代码
│   ├── app.js             # 主应用逻辑
│   ├── modules/           # 功能模块
│   │   ├── news.js        # 新闻模块
│   │   ├── movies.js      # 影视模块
│   │   ├── dictionary.js  # 词典模块
│   │   ├── expressions.js # 语用模块
│   │   └── aiAssistant.js # AI助手模块
│   ├── services/          # 服务层
│   │   ├── api.js         # API调用
│   │   ├── storage.js     # 本地存储
│   │   ├── newsService.js # 新闻服务
│   │   └── ...
│   ├── utils/             # 工具函数
│   ├── server/            # 服务器端脚本
│   │   ├── update_data.py # 数据更新脚本
│   │   └── deploy.sh      # 部署脚本
│   └── tools/             # 工具脚本
│       └── import_french_dict.py # 词典导入脚本
│
├── styles/                 # 样式文件
│   └── main.css
│
└── public/                 # 静态资源
    └── data/              # 数据文件
        ├── dicts/         # 词典数据
        ├── news.json      # 新闻数据
        └── movies.json    # 影视数据
```

## 🛠️ 技术栈

- **前端**：原生JavaScript (ES6+)、Tailwind CSS
- **存储**：LocalStorage、IndexedDB
- **后端服务**：Python（数据更新脚本）
- **AI服务**：DeepSeek API、Coze API

## 📝 使用说明

> 💡 **开发注意事项**：请查看 [DEVELOPMENT_NOTES.md](./DEVELOPMENT_NOTES.md) 了解开发过程中的重要注意事项和常见问题解决方案。

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

### 云服务器部署（推荐）

```bash
# 1. 上传项目到服务器
scp -r /path/to/AI_LL root@服务器IP:/var/www/

# 2. 配置 Nginx
# 创建配置文件 /etc/nginx/sites-available/french-ai
# 指向项目目录

# 3. 设置定时任务更新数据
crontab -e
# 添加：0 */6 * * * cd /var/www/AI_LL && python3 scripts/server/update_data.py
```

### 静态网站托管

项目可以部署到 Vercel、Netlify、GitHub Pages 等静态托管平台。

> **注意**：静态托管无法运行定时任务，需要手动更新数据或使用 GitHub Actions。

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

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受你的法语学习之旅！** 🇫🇷
