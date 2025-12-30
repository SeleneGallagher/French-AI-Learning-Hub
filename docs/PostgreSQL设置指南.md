# 🐘 Railway PostgreSQL 设置指南

## 📋 前置条件

- ✅ 已在 Railway 部署主应用
- ✅ 已配置其他环境变量（Coze、DeepSeek、TMDB 等）

---

## 🚀 快速设置（5分钟）

### 步骤 1：在 Railway 中添加 PostgreSQL 服务

1. 进入你的 Railway 项目页面
2. 点击 **"New"** 按钮
3. 选择 **"Database"** → **"Add PostgreSQL"**
4. Railway 会自动创建 PostgreSQL 数据库

### 步骤 2：获取数据库连接信息

Railway 会自动设置 `DATABASE_URL` 环境变量，包含：
- 主机地址
- 端口
- 数据库名
- 用户名
- 密码

**无需手动配置！** Railway 会自动注入到你的应用中。

### 步骤 3：初始化数据库

有两种方式初始化数据库：

#### 方法 A：使用 Railway CLI（推荐）

```bash
# 1. 安装 Railway CLI（如果还没有）
npm install -g @railway/cli

# 2. 登录
railway login

# 3. 连接到项目
railway link

# 4. 运行 SQL 初始化脚本
railway run psql $DATABASE_URL < database/init.sql
```

#### 方法 B：使用 Railway Dashboard

1. 在 Railway Dashboard 中，点击 PostgreSQL 服务
2. 进入 **"Data"** 标签
3. 点击 **"Query"** 按钮
4. 复制 `database/init.sql` 的内容
5. 粘贴到查询窗口并执行

#### 方法 C：使用本地 psql 客户端

```bash
# 1. 从 Railway 获取 DATABASE_URL
railway variables

# 2. 使用 psql 连接
psql $DATABASE_URL < database/init.sql
```

### 步骤 4：设置 JWT_SECRET

在 Railway Dashboard → Variables 中添加：

```
JWT_SECRET=your-generated-secret-key
```

**生成方式**：
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Python
python -c "import secrets; print(secrets.token_hex(32))"
```

### 步骤 5：重新部署应用

Railway 会自动检测到环境变量变化并重新部署，或者：

```bash
railway up
```

---

## ✅ 验证设置

### 1. 检查环境变量

在 Railway Dashboard → Variables 中确认：
- ✅ `DATABASE_URL` 已自动设置（由 PostgreSQL 服务提供）
- ✅ `JWT_SECRET` 已设置

### 2. 测试数据库连接

访问 `/health` 端点，应该返回正常。

### 3. 测试注册功能

1. 打开应用
2. 点击注册
3. 使用注册码：`DEMO2024`（数据库初始化时创建的）
4. 填写用户名和密码
5. 应该能成功注册

### 4. 测试登录功能

使用刚才注册的账号登录，应该能成功。

---

## 📝 数据库结构

初始化脚本会创建以下表：

1. **users** - 用户表
   - id (UUID)
   - username (VARCHAR)
   - password_hash (VARCHAR)
   - is_active (BOOLEAN)
   - created_at, last_login, updated_at (TIMESTAMP)

2. **registration_codes** - 注册码表
   - id (UUID)
   - code (VARCHAR)
   - is_active (BOOLEAN)
   - unlimited_use (BOOLEAN)
   - used_at, used_by_user_id (TIMESTAMP, UUID)

3. **dict_history** - 词典查询历史表
   - id (UUID)
   - user_id (UUID, 外键)
   - word (VARCHAR)
   - searched_at (TIMESTAMP)

---

## 🔧 管理注册码

### 添加新的注册码

```sql
-- 添加无限使用的注册码
INSERT INTO registration_codes (code, unlimited_use, is_active) 
VALUES ('YOUR_CODE', TRUE, TRUE);

-- 添加单次使用的注册码
INSERT INTO registration_codes (code, unlimited_use, is_active) 
VALUES ('SINGLE_USE_CODE', FALSE, TRUE);
```

### 查看所有注册码

```sql
SELECT code, unlimited_use, is_active, used_at, used_by_user_id 
FROM registration_codes 
ORDER BY created_at DESC;
```

### 禁用注册码

```sql
UPDATE registration_codes 
SET is_active = FALSE 
WHERE code = 'YOUR_CODE';
```

---

## 🐛 常见问题

### Q1: DATABASE_URL 未设置

**原因**：PostgreSQL 服务未正确连接到主应用

**解决**：
1. 确认 PostgreSQL 服务已创建
2. 在 Railway Dashboard 中，检查主应用是否能看到 PostgreSQL 服务
3. 如果看不到，重新添加 PostgreSQL 服务

### Q2: 数据库连接失败

**原因**：可能是 SSL 配置问题

**解决**：
- 检查 `lib/utils.py` 中的 SSL 配置
- Railway PostgreSQL 默认需要 SSL 连接

### Q3: 表已存在错误

**原因**：数据库已经初始化过

**解决**：
- 这是正常的，`CREATE TABLE IF NOT EXISTS` 会跳过已存在的表
- 或者删除现有表后重新初始化

### Q4: 注册码无效

**原因**：注册码不存在或已使用

**解决**：
- 检查 `registration_codes` 表
- 使用默认注册码：`DEMO2024`
- 或添加新的注册码

---

## 📚 相关文档

- [Railway 部署指南](./Railway部署指南.md)
- [环境变量清单](./环境变量清单.md)

---

**最后更新**：2024-12-19

