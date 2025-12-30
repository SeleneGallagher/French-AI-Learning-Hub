# 开发注意事项

本文档记录开发过程中遇到的重要问题和解决方案，避免重复犯错。

## Git 提交

### ⚠️ 提交信息必须使用英文
**问题**：在 Windows PowerShell 环境中，使用中文提交信息会导致编码错误。

**错误示例**：
```bash
git commit -m "修复 Vercel 部署问题"  # ❌ 会失败
```

**正确做法**：
```bash
git commit -m "Fix Vercel deployment issues"  # ✅ 成功
```

**原因**：PowerShell 对中文字符的编码处理可能导致命令解析失败。

---

## 部署说明

> **注意**：项目已从 Vercel 迁移，现在使用 Railway 或其他平台部署。详见 [部署方案指南](./docs/部署方案.md)

### Railway 部署（当前推荐）

- 使用 `Procfile` 配置启动命令
- 环境变量在 Railway Dashboard 中配置
- 详细步骤请参考 [Railway 部署指南](./docs/Railway部署指南.md)

### 环境变量命名
- ✅ 项目已移除 Supabase 依赖，不再需要 Supabase 相关环境变量
- ✅ 所有数据使用本地存储（localStorage/IndexedDB）

### 静态文件路径
- 前端代码中使用 `/public/data/...`（带前导斜杠）
- Flask 应用会自动提供静态文件

### API 路由
- 所有 API 处理函数必须处理 OPTIONS 请求（CORS 预检）
- Flask 路由在 `app.py` 中统一管理

---

## 代码规范

### 文件编码
- 所有代码文件使用 UTF-8 编码
- Windows 系统注意 CRLF vs LF 换行符问题

### 错误处理
- API 函数必须包含异常处理
- 返回统一的 JSON 响应格式

---

## 常见问题

### PowerShell 命令执行失败
**问题**：某些命令在 PowerShell 中执行失败

**解决方案**：
- 使用 PowerShell 语法（如 `Test-Path` 而不是 `if not exist`）
- 或者使用 Git Bash 执行命令

### 文件路径问题
**Windows**：使用反斜杠 `\` 或正斜杠 `/`（Git 会自动处理）
**Linux/Mac**：使用正斜杠 `/`

---

## 部署检查清单

部署前确保：
- [ ] 所有环境变量已配置
- [ ] 静态文件已创建
- [ ] API 路由已测试
- [ ] CORS 配置正确
- [ ] 提交信息使用英文
- [ ] 代码已推送到 Git

---

## Flask 应用部署

### 当前架构
- 使用 Flask 作为统一后端框架
- 所有 API 路由在 `app.py` 中定义
- 使用 Gunicorn 作为 WSGI 服务器

### 部署平台
- **Railway**（推荐）：简单易用，免费额度充足
- **Render**：免费套餐可用
- **Fly.io**：全球边缘部署
- **云服务器**：完全控制，适合国内用户

详细部署指南请参考 [部署方案指南](./docs/部署方案.md)

### Request 对象适配
Flask 应用使用适配器将 Flask request 转换为 Vercel 格式，以复用现有 API handler：
```python
class VercelRequest:
    def __init__(self, flask_request):
        self.method = flask_request.method
        self.headers = flask_request.headers
        self.json = flask_request.get_json(silent=True)
        self.form = flask_request.form
        self.args = flask_request.args
```

---

## 更新日志

- 2024-12-19: 添加 Git 提交信息必须使用英文的注意事项
- 2024-12-19: 记录 Vercel 部署相关注意事项
- 2024-12-19: 添加 Vercel Serverless Functions 限制和解决方案
- 2024-12-19: 添加 Vercel Python Serverless Functions 路由规则和 request 对象格式说明
- 2024-12-19: 从 Vercel 迁移到 Railway，更新部署文档

