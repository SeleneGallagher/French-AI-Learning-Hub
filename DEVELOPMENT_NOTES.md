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

## Vercel 部署

### 环境变量命名
- ✅ 使用 `SUPABASE_SECRET_KEY`（不是 `SUPABASE_SERVICE_KEY`）
- 确保所有环境变量在 Vercel Dashboard 中正确配置

### 静态文件路径
- 前端代码中使用 `/public/data/...`（带前导斜杠）
- Vercel 会自动提供 `public` 目录下的静态文件

### API 路由
- Python Serverless Functions 需要 `__init__.py` 文件使目录成为包
- 所有 API 处理函数必须处理 OPTIONS 请求（CORS 预检）

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

## 更新日志

- 2024-12-19: 添加 Git 提交信息必须使用英文的注意事项
- 2024-12-19: 记录 Vercel 部署相关注意事项

