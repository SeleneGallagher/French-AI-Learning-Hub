# GitHub上传指南

## 🚀 快速步骤

### 1. 初始化Git仓库

```bash
# 在项目根目录
git init
```

### 2. 添加所有文件

```bash
git add .
```

### 3. 提交代码

```bash
git commit -m "Initial commit: Vercel + Supabase setup"
```

### 4. 创建GitHub仓库

1. 访问 https://github.com
2. 点击右上角 "+" → "New repository"
3. 填写信息：
   - Repository name: `french-ai-learning` (或你喜欢的名字)
   - Description: `French AI Learning Hub - 法语学习平台`
   - 选择 Public 或 Private
   - **不要**勾选 "Initialize with README"
4. 点击 "Create repository"

### 5. 连接并推送

```bash
# 添加远程仓库（替换YOUR_USERNAME为你的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/french-ai-learning.git

# 重命名分支为main（如果还没有）
git branch -M main

# 推送代码
git push -u origin main
```

### 6. 输入GitHub凭证

如果提示输入用户名和密码：
- 用户名：你的GitHub用户名
- 密码：使用 Personal Access Token（不是GitHub密码）

**如何获取Token**：
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. 勾选 `repo` 权限
4. 生成并复制Token（只显示一次，保存好）

---

## 📋 后续更新

```bash
# 修改代码后
git add .
git commit -m "描述你的修改"
git push
```

---

## ✅ 检查清单

- [ ] Git仓库已初始化
- [ ] 代码已提交
- [ ] GitHub仓库已创建
- [ ] 远程仓库已连接
- [ ] 代码已推送成功

---

## 🎯 下一步

代码推送到GitHub后，就可以在Vercel中导入项目了！

查看 `Vercel+Supabase部署指南.md` 继续部署。


