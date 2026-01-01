# 电影模块服务器端缓存实现方案

## 一、架构设计

### 1.1 数据流程
```
TMDB API → 缓存更新脚本 → PostgreSQL数据库 → API端点 → 前端
                ↓
          (每6小时自动更新)
```

### 1.2 核心组件
1. **数据库表**: `cached_movies` - 存储处理好的电影数据
2. **缓存更新脚本**: `scripts/server/update_movies_cache.py` - 定期从TMDB获取并处理数据
3. **API端点**: `/api/movies/cached` - 返回缓存的电影列表
4. **前端适配**: 优先使用缓存API，fallback到直接TMDB调用

---

## 二、数据库设计

### 2.1 表结构 (`cached_movies`)
```sql
CREATE TABLE IF NOT EXISTS cached_movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL UNIQUE,  -- TMDB电影/剧集ID
    type VARCHAR(10) NOT NULL,         -- 'movie' 或 'tv'
    
    -- 基本信息
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    release_date DATE,
    
    -- 评分和统计
    rating NUMERIC(3,1) NOT NULL,
    vote_count INTEGER DEFAULT 0,
    
    -- 媒体信息
    poster_path TEXT,
    backdrop_path TEXT,
    plot TEXT,                         -- 完整简介
    plot_truncated TEXT,               -- 截断后的简介（150字符）
    tagline TEXT,
    tagline_truncated TEXT,            -- 截断后的评语（60字符）
    
    -- 详细信息
    director TEXT,                     -- 导演/创作者
    genres JSONB,                      -- 类型数组 ['动作', '剧情']
    runtime INTEGER,                   -- 电影时长（分钟）
    seasons INTEGER,                   -- 剧集季数
    episodes INTEGER,                  -- 剧集集数
    media_info TEXT,                   -- 格式化信息 "120分钟" 或 "3季 · 24集"
    
    -- 分类标记
    is_recent BOOLEAN DEFAULT FALSE,   -- 近两年（year >= current_year - 2）
    is_classic BOOLEAN DEFAULT FALSE,   -- 经典（year < current_year - 5）
    
    -- 元数据
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cached_movies_type ON cached_movies(type);
CREATE INDEX IF NOT EXISTS idx_cached_movies_rating ON cached_movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_cached_movies_recent ON cached_movies(is_recent) WHERE is_recent = TRUE;
CREATE INDEX IF NOT EXISTS idx_cached_movies_classic ON cached_movies(is_classic) WHERE is_classic = TRUE;
CREATE INDEX IF NOT EXISTS idx_cached_movies_year ON cached_movies(year DESC);
CREATE INDEX IF NOT EXISTS idx_cached_movies_updated ON cached_movies(updated_at DESC);
```

### 2.2 数据特点
- **去重**: 使用 `tmdb_id + type` 唯一约束
- **完整信息**: 所有字段都已处理，前端无需再调用TMDB详情API
- **分类标记**: `is_recent` 和 `is_classic` 便于快速筛选
- **自动更新**: `updated_at` 用于判断缓存新鲜度

---

## 三、缓存更新脚本

### 3.1 文件位置
`scripts/server/update_movies_cache.py`

### 3.2 功能流程
```
1. 连接数据库
2. 从TMDB获取数据（多页，每类20页）
   - 近两年电影 (recent movies)
   - 经典电影 (classic movies)
   - 其他电影 (other movies)
   - 近两年剧集 (recent TV)
   - 经典剧集 (classic TV)
   - 其他剧集 (other TV)
3. 去重（基于tmdb_id + type）
4. 获取每个项目的详细信息（详情API）
   - 检查是否有tagline（必需）
   - 检查是否有法语简介（必需）
   - 获取导演/创作者
   - 获取完整类型信息
5. 处理数据
   - 截断简介（150字符）
   - 截断评语（60字符）
   - 格式化media_info
   - 标记is_recent和is_classic
6. 批量插入/更新数据库
   - 使用UPSERT（ON CONFLICT UPDATE）
   - 只更新updated_at字段
7. 清理旧数据（可选，删除超过7天未更新的记录）
```

### 3.3 配置参数
```python
MIN_RATING = 7.0              # 最低评分
TARGET_COUNT = 200           # 目标缓存数量
MAX_PAGES_PER_CATEGORY = 20  # 每类最多获取页数
CACHE_EXPIRY_DAYS = 7       # 缓存过期天数
```

---

## 四、API端点设计

### 4.1 端点: `/api/movies/cached`

#### 请求参数
```
GET /api/movies/cached?page=1&limit=25&type=mixed&category=all
```

**参数说明**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认25，最大100）
- `type`: 类型筛选 - `movie` | `tv` | `mixed`（默认mixed）
- `category`: 分类筛选 - `recent` | `classic` | `all`（默认all）
- `min_rating`: 最低评分（默认7.0）

#### 响应格式
```json
{
  "success": true,
  "data": {
    "movies": [
      {
        "id": 123,
        "tmdb_id": 456,
        "type": "movie",
        "title": "电影标题",
        "original_title": "Original Title",
        "year": 2023,
        "rating": 8.5,
        "poster": "https://image.tmdb.org/t/p/w500/poster.jpg",
        "plot": "简介（截断）...",
        "fullPlot": "完整简介",
        "tagline": "评语（截断）...",
        "director": "导演名",
        "genres": ["动作", "剧情"],
        "runtime": 120,
        "mediaInfo": "120分钟",
        "isRecent": true,
        "isClassic": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 200,
      "totalPages": 8
    }
  }
}
```

#### 查询逻辑
```sql
-- 基础查询
SELECT * FROM cached_movies
WHERE rating >= :min_rating
  AND (type = :type OR :type = 'mixed')
  AND (
    (:category = 'all') OR
    (:category = 'recent' AND is_recent = TRUE) OR
    (:category = 'classic' AND is_classic = TRUE)
  )
ORDER BY 
  CASE WHEN :category = 'recent' THEN is_recent END DESC,
  CASE WHEN :category = 'classic' THEN is_classic END DESC,
  rating DESC,
  year DESC
LIMIT :limit OFFSET :offset
```

---

## 五、前端适配

### 5.1 修改 `scripts/modules/movies.js`

#### 新的加载逻辑
```javascript
async function loadContent(forceRefresh = false) {
    // 1. 优先从缓存API获取
    try {
        const cachedData = await fetchCachedMovies({
            page: 1,
            limit: 25,
            type: 'mixed',
            category: 'all'
        });
        
        if (cachedData && cachedData.length > 0) {
            // 直接使用缓存数据，无需处理
            allMovies = cachedData;
            renderItems(allMovies);
            translateAllPlots();
            return;
        }
    } catch (error) {
        console.warn('缓存API失败，fallback到直接TMDB调用:', error);
    }
    
    // 2. Fallback: 直接TMDB调用（原有逻辑）
    // ... 保留原有代码
}

async function fetchCachedMovies(params) {
    const query = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 25,
        type: params.type || 'mixed',
        category: params.category || 'all',
        min_rating: params.min_rating || 7.0
    });
    
    const response = await fetch(`/api/movies/cached?${query}`);
    if (response.ok) {
        const data = await response.json();
        return data.data.movies || [];
    }
    throw new Error(`缓存API错误: ${response.status}`);
}
```

### 5.2 刷新逻辑
```javascript
async function refreshContent() {
    // 清除sessionStorage中的已显示记录
    sessionStorage.removeItem('shown_movies_session');
    
    // 重新加载（会从缓存获取）
    await loadContent(true);
}
```

---

## 六、定时任务

### 6.1 Railway部署
在 `app.py` 中添加后台任务：
```python
def start_background_tasks():
    """启动后台任务"""
    import threading
    import time
    
    def update_movies_cache():
        """每6小时更新一次电影缓存"""
        while True:
            try:
                time.sleep(6 * 60 * 60)  # 6小时
                print("开始更新电影缓存...")
                from scripts.server.update_movies_cache import update_cache
                update_cache()
                print("电影缓存更新完成")
            except Exception as e:
                print(f"电影缓存更新失败: {e}")
                import traceback
                traceback.print_exc()
    
    background_thread = threading.Thread(target=update_movies_cache, daemon=True)
    background_thread.start()
    print("后台任务已启动：每6小时自动更新电影缓存")
```

### 6.2 手动触发（可选）
创建管理端点 `/api/admin/update-movies-cache`（需要管理员权限）

---

## 七、实现步骤

1. ✅ **创建数据库表** - 在 `database/init.sql` 中添加 `cached_movies` 表
2. ✅ **创建缓存更新脚本** - `scripts/server/update_movies_cache.py`
3. ✅ **创建API端点** - `api/movies/cached.py`
4. ✅ **修改前端逻辑** - 优先使用缓存API
5. ✅ **添加定时任务** - 在 `app.py` 中启动后台更新
6. ✅ **测试和优化** - 确保数据质量和性能

---

## 八、性能优化

### 8.1 数据库优化
- 使用索引加速查询
- 使用部分索引（WHERE条件）减少索引大小
- 定期清理过期数据

### 8.2 缓存策略
- 缓存200+条记录，确保至少4次刷新不重复
- 按评分和年份排序，优先返回高质量内容
- 支持分页，减少单次传输数据量

### 8.3 前端优化
- 缓存API响应到localStorage（可选）
- 使用防抖避免频繁请求
- 预加载下一页数据

---

## 九、数据质量保证

### 9.1 过滤条件
- 必须有 `tagline`（评语）
- 必须有法语简介（`isFrenchText`检查）
- 评分 >= 7.0
- 有足够的投票数（vote_count >= 30）

### 9.2 数据完整性
- 所有字段都有默认值
- 处理空值和异常情况
- 验证数据格式

---

## 十、监控和日志

### 10.1 日志记录
- 缓存更新开始/结束时间
- 获取的数据量
- 处理的数据量
- 错误信息

### 10.2 监控指标
- 缓存数据总量
- 缓存更新频率
- API响应时间
- 错误率

