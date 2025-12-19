# vercel.json 配置说明

## 📋 配置结构

### version
- **值**: `2`
- **作用**: 指定Vercel配置版本
- **必要性**: 必须配置，使用Vercel v2配置格式

---

## 🔧 builds 配置

### 1. Python Serverless Functions构建

```json
{
  "src": "api/**/*.py",
  "use": "@vercel/python"
}
```

- **src**: `api/**/*.py`
  - **作用**: 匹配所有api目录下的Python文件
  - **必要性**: 必须配置，否则Python API无法工作
  
- **use**: `@vercel/python`
  - **作用**: 使用Vercel的Python运行时
  - **必要性**: 必须配置，告诉Vercel如何处理Python文件

### 2. 静态文件构建

```json
{
  "src": "package.json",
  "use": "@vercel/static-build",
  "config": {
    "distDir": "."
  }
}
```

- **src**: `package.json`
  - **作用**: 作为静态文件构建的触发点
  - **必要性**: 必须配置，Vercel需要这个文件来触发静态构建
  
- **use**: `@vercel/static-build`
  - **作用**: 使用Vercel的静态文件构建器
  - **必要性**: 必须配置，明确告诉Vercel需要包含静态文件
  
- **config.distDir**: `"."`
  - **作用**: 指定静态文件在根目录
  - **必要性**: 必须配置，否则静态文件不会被部署，导致404错误
  - **说明**: 如果静态文件在`public`目录，应设置为`"public"`

---

## 🛣️ routes 配置

### 1. API路由

```json
{
  "src": "/api/(.*)",
  "dest": "/api/$1"
}
```

- **src**: `/api/(.*)`
  - **作用**: 匹配所有以`/api/`开头的请求
  - **必要性**: 必须配置，否则API请求无法到达后端
  
- **dest**: `/api/$1`
  - **作用**: 将请求路由到对应的Python Serverless Function
  - **必要性**: 必须配置，确保API请求能正确路由

### 2. 静态资源路由

```json
{
  "src": "/(.*\\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot))",
  "dest": "/$1"
}
```

- **src**: 匹配所有静态资源文件扩展名
  - **作用**: 识别JS、CSS、图片、字体等静态文件
  - **必要性**: 必须配置，确保静态资源能正确加载
  
- **dest**: `/$1`
  - **作用**: 直接返回静态文件，不经过重写
  - **必要性**: 必须配置，避免静态资源被错误路由

### 3. Fallback路由（SPA路由）

```json
{
  "src": "/(.*)",
  "dest": "/index.html"
}
```

- **src**: `/(.*)`
  - **作用**: 匹配所有其他请求
  - **必要性**: 必须配置，支持前端路由
  
- **dest**: `/index.html`
  - **作用**: 所有其他请求都返回index.html，支持SPA路由
  - **必要性**: 必须配置，确保刷新页面或直接访问路由时不会404

---

## ⚠️ 重要说明

### 为什么需要双重构建配置？

1. **Python函数构建**: 必须明确配置，否则API无法工作
2. **静态文件构建**: 必须明确配置，否则静态文件不会被部署

### 为什么不能依赖自动检测？

- Vercel的自动检测对于混合项目（Python + 静态文件）可能不准确
- 明确配置可以确保所有内容都被正确构建和部署

### 配置顺序的重要性

- `routes`中的顺序很重要
- API路由应该在静态资源路由之前
- Fallback路由应该在最后

---

## 📝 总结

**必须配置的内容**：
1. ✅ Python函数构建（`api/**/*.py`）
2. ✅ 静态文件构建（`package.json` + `distDir: "."`）
3. ✅ API路由（`/api/(.*)`）
4. ✅ 静态资源路由（文件扩展名匹配）
5. ✅ Fallback路由（`/(.*)` → `index.html`）

**核心原理**：
- 当使用`builds`配置时，Vercel**只构建**配置中指定的内容
- 必须**明确告诉Vercel**需要构建静态文件
- 路由配置确保请求能正确到达对应的处理程序

