# RLS和service_role key说明

## 🤔 什么是RLS？

**RLS = Row Level Security（行级安全）**

这是Supabase的安全机制，确保：
- ✅ 用户A只能看到自己的数据
- ✅ 用户B只能看到自己的数据
- ✅ 用户之间数据隔离

**简单理解**：就像每个用户有自己的房间，只能进自己的房间。

---

## 🔑 什么是service_role key？

Supabase有两种密钥：

### 1. **anon key**（公开密钥）
- ✅ 前端可以用
- ❌ 受RLS限制（只能访问自己的数据）
- ⚠️ 安全性较低

### 2. **service_role key**（服务密钥）⭐
- ✅ 后端服务器用
- ✅ **可以绕过RLS**（因为后端已经验证了用户身份）
- ✅ 安全性高
- ⚠️ **绝对不能暴露给前端！**

---

## 🎯 我们的方案

```
前端 → 发送请求（带JWT Token）
  ↓
后端Serverless Function
  ↓
验证JWT Token（确认用户身份）
  ↓
使用service_role key连接Supabase
  ↓
绕过RLS，访问该用户的数据
```

**为什么可以绕过RLS？**
- 因为后端已经通过JWT Token验证了用户身份
- 后端知道是哪个用户在请求
- 所以后端可以安全地访问该用户的数据

---

## ✅ 你需要做什么？

### 1. 在Supabase获取service_role key

1. 打开Supabase项目
2. 点击左侧 **Settings** → **API**
3. 找到 **service_role key**（不是anon key！）
4. 复制这个密钥

### 2. 在Vercel设置环境变量

在Vercel项目设置中添加：
- `SUPABASE_URL` = 你的Supabase项目URL
- `SUPABASE_SERVICE_KEY` = 你复制的service_role key
- `JWT_SECRET` = 任意随机字符串（用于加密JWT）

---

## 📋 总结

1. **RLS**：Supabase的安全机制，确保数据隔离
2. **service_role key**：后端用的密钥，可以绕过RLS
3. **工作流程**：前端 → 后端验证身份 → 后端用service_role key访问数据

**你只需要**：
- ✅ 执行SQL启用RLS（已经在`supabase_init.sql`中）
- ✅ 复制service_role key到Vercel环境变量
- ✅ 完成！

