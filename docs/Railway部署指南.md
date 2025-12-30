# 🚂 Railway 部署完整指南

本指南将帮助你一步步将项目部署到 Railway。

## 📋 前置要求

1. **GitHub 账号**（用于登录 Railway）
2. **项目已推送到 GitHub**（Railway 需要从 GitHub 部署）
3. **环境变量清单**（见下方）

---

## 🚀 快速部署（5分钟）

### 方法一：使用 Railway Dashboard（推荐）

#### 步骤 1：注册并登录 Railway

1. 访问 https://railway.app
2. 点击 **"Start a New Project"**
3. 选择 **"Login with GitHub"** 使用 GitHub 账号登录
4. 授权 Railway 访问你的 GitHub 仓库

#### 步骤 2：创建新项目

1. 点击 **"New Project"**
2. 选择 **"Deploy from GitHub repo"**
3. 选择你的项目仓库（AI_LL）
4. Railway 会自动检测项目类型

#### 步骤 3：配置环境变量

在 Railway Dashboard 中，点击项目 → **Variables** 标签，添加以下环境变量：

**必需的环境变量：**
```
DATABASE_URL=postgresql://...  # Railway 自动设置（添加 PostgreSQL 服务后）
JWT_SECRET=your-jwt-secret-key  # 必须使用强随机字符串
```

**可选的环境变量（根据你的需求添加）：**
```
COZE_BOT_ID=your-bot-id
COZE_PAT_TOKEN=your-pat-token
DEEPSEEK_API_KEY=your-deepseek-key
TMDB_API_KEY=your-tmdb-key
```

#### 步骤 4：部署

1. Railway 会自动开始部署
2. 等待构建完成（通常 2-5 分钟）
3. 部署成功后，Railway 会提供一个域名，格式如：`your-project.railway.app`

#### 步骤 5：配置自定义域名（可选）

1. 在项目设置中找到 **Settings** → **Domains**
2. 点击 **"Custom Domain"**
3. 输入你的域名（如 `french-ai.example.com`）
4. 按照提示配置 DNS 记录

---

### 方法二：使用 Railway CLI

#### 步骤 1：安装 Railway CLI

**Windows (PowerShell):**
```powershell
iwr https://railway.app/install.ps1 | iex
```

**Mac/Linux:**
```bash
curl -fsSL https://railway.app/install.sh | sh
```

**或使用 npm:**
```bash
npm install -g @railway/cli
```

#### 步骤 2：登录

```bash
railway login
```

#### 步骤 3：初始化项目

```bash
# 在项目根目录执行
railway init
```

#### 步骤 4：设置环境变量

```bash
# 设置必需变量
railway variables set JWT_SECRET=your-generated-secret-key

# 设置可选变量
railway variables set COZE_BOT_ID=your-bot-id
railway variables set COZE_PAT_TOKEN=your-pat-token
railway variables set DEEPSEEK_API_KEY=your-deepseek-key
railway variables set TMDB_API_KEY=your-tmdb-key

# 或从 .env 文件导入（推荐）
railway variables --file .env
```

> **注意**：`DATABASE_URL` 会在添加 PostgreSQL 服务时自动设置，无需手动配置。

#### 步骤 5：部署

```bash
railway up
```

#### 步骤 6：查看日志

```bash
railway logs
```

#### 步骤 7：打开网站

```bash
railway open
```

---

## 🔧 使用部署脚本（最简单）

### Windows 用户

```bash
# 双击运行或在命令行执行
scripts\deploy_railway.bat
```

### Linux/Mac 用户

```bash
# 添加执行权限（首次使用）
chmod +x scripts/deploy_railway.sh

# 运行脚本
./scripts/deploy_railway.sh
```

脚本会自动：
1. 检查并安装 Railway CLI
2. 引导你登录
3. 初始化项目
4. 提示你设置环境变量
5. 开始部署

---

## 📝 环境变量详细说明

### 必需变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `DATABASE_URL` | PostgreSQL 数据库连接 URL | Railway 自动设置（添加 PostgreSQL 服务后） |
| `JWT_SECRET` | JWT 签名密钥 | 自行生成（使用 `openssl rand -hex 32` 或 Python `secrets.token_hex(32)`） |

### 可选变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `COZE_BOT_ID` | Coze 机器人 ID | Coze 平台 → 机器人设置 |
| `COZE_PAT_TOKEN` | Coze 访问令牌 | Coze 平台 → 开发者设置 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | https://platform.deepseek.com/api_keys |
| `TMDB_API_KEY` | TMDB API 密钥 | https://www.themoviedb.org/settings/api |
| `JWT_SECRET` | JWT 签名密钥（用于认证） | 自行生成（随机字符串） |

### 生成 JWT_SECRET（如果需要）

```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## 🎯 部署后检查清单

部署完成后，请检查以下内容：

- [ ] 访问 `/health` 端点，应该返回 `{"status": "ok"}`
- [ ] 访问 `/api/config` 端点，检查配置是否正确
- [ ] 测试登录功能（如果配置了认证）
- [ ] 测试 AI 助手功能（如果配置了 Coze）
- [ ] 检查静态文件是否正常加载
- [ ] 查看 Railway 日志，确认没有错误

---

## 🐛 常见问题

### Q1: 部署失败，提示 "Build failed"

**可能原因：**
- Python 版本不匹配
- 依赖安装失败
- 代码语法错误

**解决方案：**
1. 检查 `runtime.txt` 中的 Python 版本（应该是 `python-3.11`）
2. 检查 `requirements_server.txt` 中的依赖是否正确
3. 查看 Railway 构建日志，找到具体错误

### Q2: 应用启动后立即崩溃

**可能原因：**
- 环境变量未设置
- 端口配置错误
- 数据库连接失败

**解决方案：**
1. 检查所有必需的环境变量是否已设置
2. 确认 `Procfile` 中使用 `$PORT` 变量（Railway 会自动注入）
3. 查看日志：`railway logs`

### Q3: API 返回 404

**可能原因：**
- 路由配置错误
- 静态文件路由冲突

**解决方案：**
1. 检查 `app.py` 中的路由配置
2. 确认 API 路径以 `/api/` 开头
3. 测试 `/health` 端点是否正常

### Q4: 静态文件无法加载

**可能原因：**
- Flask 静态文件配置问题
- 文件路径错误

**解决方案：**
1. 检查 `app.py` 中的 `static_folder` 配置
2. 确认文件存在于正确路径
3. 考虑使用 CDN 或对象存储（如 Supabase Storage）

### Q5: 如何查看实时日志？

```bash
railway logs --follow
```

### Q6: 如何重启服务？

在 Railway Dashboard 中：
1. 进入项目
2. 点击服务
3. 点击 **"Restart"** 按钮

或使用 CLI：
```bash
railway restart
```

### Q7: 如何更新代码？

Railway 支持自动部署：
1. 推送代码到 GitHub
2. Railway 会自动检测并重新部署

或手动触发：
```bash
git push
railway up
```

---

## 💰 Railway 定价

### Hobby 套餐（免费额度）

- **$5/月免费额度**
- 足够小到中型项目使用
- 超出后按使用量付费

### 查看使用量

在 Railway Dashboard → **Usage** 查看当前使用情况。

---

## 🔒 安全建议

1. **不要提交敏感信息**
   - 确保 `.env` 文件在 `.gitignore` 中
   - 不要在代码中硬编码密钥

2. **使用环境变量**
   - 所有敏感配置都通过环境变量设置

3. **定期更新依赖**
   - 定期运行 `pip install --upgrade -r requirements_server.txt`

---

## 📚 相关资源

- [Railway 官方文档](https://docs.railway.app)
- [Railway Discord 社区](https://discord.gg/railway)
- [项目部署方案总览](./部署方案.md)

---

## 🎉 部署成功！

部署完成后，你的应用将运行在：
- **Railway 提供的域名**：`https://your-project.railway.app`
- **自定义域名**（如果配置了）：`https://your-domain.com`

**下一步：**
1. 测试所有功能
2. 配置自定义域名（可选）
3. 设置监控和告警（可选）

---

**最后更新**：2024-12-19

