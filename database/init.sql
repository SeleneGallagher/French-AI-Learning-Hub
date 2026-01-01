-- Railway PostgreSQL 数据库初始化脚本（完整版）
-- 用于 French AI Learning Hub
-- 
-- 本脚本包含所有功能模块需要的数据表

-- ============================================
-- 1. 用户表 (users)
-- ============================================
-- 用途：存储用户账号信息
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 索引：用户名查询（登录时使用）
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE is_active = TRUE;

-- ============================================
-- 2. 注册码表 (registration_codes)
-- ============================================
-- 用途：管理用户注册码
CREATE TABLE IF NOT EXISTS registration_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    unlimited_use BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 索引：注册码查询（注册时使用）
CREATE INDEX IF NOT EXISTS idx_registration_codes_code ON registration_codes(code) WHERE is_active = TRUE;

-- ============================================
-- 3. 词典查询历史表 (dict_history)
-- ============================================
-- 用途：存储用户查询的单词历史
CREATE TABLE IF NOT EXISTS dict_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(255) NOT NULL,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_word UNIQUE(user_id, word)
);

-- 索引：按用户查询历史记录（按时间倒序）
CREATE INDEX IF NOT EXISTS idx_dict_history_user_time ON dict_history(user_id, searched_at DESC);

-- ============================================
-- 4. 词典收藏表 (dict_favorites)
-- ============================================
-- 用途：存储用户收藏的单词
CREATE TABLE IF NOT EXISTS dict_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(255) NOT NULL,
    phonetic TEXT,
    pos JSONB,  -- 词性信息（JSON格式）
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_favorite_word UNIQUE(user_id, word)
);

-- 索引：按用户查询收藏
CREATE INDEX IF NOT EXISTS idx_dict_favorites_user ON dict_favorites(user_id, added_at DESC);

-- ============================================
-- 5. 背单词进度表 (vocab_progress)
-- ============================================
-- 用途：存储用户背单词的学习进度
CREATE TABLE IF NOT EXISTS vocab_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(255) NOT NULL,
    quality INTEGER DEFAULT 0,  -- 0=生疏, 1=模糊, 2=熟练
    count INTEGER DEFAULT 0,    -- 复习次数
    last_review TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_vocab_word UNIQUE(user_id, word)
);

-- 索引：按用户查询学习进度
CREATE INDEX IF NOT EXISTS idx_vocab_progress_user ON vocab_progress(user_id, last_review DESC);
CREATE INDEX IF NOT EXISTS idx_vocab_progress_quality ON vocab_progress(user_id, quality) WHERE quality < 2;  -- 只索引需要复习的单词

-- ============================================
-- 6. 语用表达表 (expressions)
-- ============================================
-- 用途：存储用户生成的语用表达
-- 注意：expressions 主要存储在本地 IndexedDB，此表用于跨设备同步
CREATE TABLE IF NOT EXISTS expressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,  -- 学习场景
    expressions JSONB NOT NULL,  -- 表达数组（JSON格式）
    cultural_tips TEXT,  -- 文化提示
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：按用户查询表达
CREATE INDEX IF NOT EXISTS idx_expressions_user ON expressions(user_id, created_at DESC);

-- ============================================
-- 7. 语用收藏表 (expression_favorites)
-- ============================================
-- 用途：存储用户收藏的语用表达
-- 注意：expressions 存储在本地 IndexedDB，所以这里只存储收藏的数据
-- 通过 expression_data 存储完整的表达信息
CREATE TABLE IF NOT EXISTS expression_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expression_data JSONB NOT NULL,  -- 存储完整的表达数据（场景、表达、翻译等）
    expression_id TEXT,  -- 从 expression_data 中提取的 id（用于唯一约束）
    favorited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 唯一约束：同一用户不能重复收藏相同的表达
    CONSTRAINT unique_user_expression_favorite UNIQUE(user_id, expression_id)
);

-- 索引：按用户查询收藏
CREATE INDEX IF NOT EXISTS idx_expression_favorites_user ON expression_favorites(user_id, favorited_at DESC);

-- ============================================
-- 8. AI聊天记录表 (ai_chat_history)
-- ============================================
-- 用途：存储AI助手的聊天记录
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' 或 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：按用户查询聊天记录（按时间顺序）
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_time ON ai_chat_history(user_id, created_at ASC);

-- ============================================
-- 9. 电影收藏表 (movie_watchlist)
-- ============================================
-- 用途：存储用户想看的电影/剧集
CREATE TABLE IF NOT EXISTS movie_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,  -- TMDB 电影/剧集 ID
    movie_type VARCHAR(10) NOT NULL,  -- 'movie' 或 'tv'
    title TEXT NOT NULL,
    poster_path TEXT,
    overview TEXT,
    release_date DATE,
    vote_average NUMERIC(3,1),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_movie UNIQUE(user_id, movie_id, movie_type)
);

-- 索引：按用户查询收藏
CREATE INDEX IF NOT EXISTS idx_movie_watchlist_user ON movie_watchlist(user_id, added_at DESC);

-- ============================================
-- 11. 电影缓存表 (cached_movies)
-- ============================================
-- 用途：存储从TMDB获取并处理好的电影/剧集数据，供前端快速加载
CREATE TABLE IF NOT EXISTS cached_movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,  -- TMDB电影/剧集ID
    type VARCHAR(10) NOT NULL,  -- 'movie' 或 'tv'
    
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
    plot TEXT,  -- 完整简介
    plot_truncated TEXT,  -- 截断后的简介（150字符）
    tagline TEXT,
    tagline_truncated TEXT,  -- 截断后的评语（60字符）
    
    -- 详细信息
    director TEXT,  -- 导演/创作者
    genres JSONB,  -- 类型数组 ['动作', '剧情']
    runtime INTEGER,  -- 电影时长（分钟）
    seasons INTEGER,  -- 剧集季数
    episodes INTEGER,  -- 剧集集数
    media_info TEXT,  -- 格式化信息 "120分钟" 或 "3季 · 24集"
    
    -- 分类标记
    is_recent BOOLEAN DEFAULT FALSE,  -- 近两年（year >= current_year - 2）
    is_classic BOOLEAN DEFAULT FALSE,  -- 经典（year < current_year - 5）
    
    -- 元数据
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tmdb_movie UNIQUE(tmdb_id, type)
);

-- 索引：优化查询性能
CREATE INDEX IF NOT EXISTS idx_cached_movies_type ON cached_movies(type);
CREATE INDEX IF NOT EXISTS idx_cached_movies_rating ON cached_movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_cached_movies_recent ON cached_movies(is_recent) WHERE is_recent = TRUE;
CREATE INDEX IF NOT EXISTS idx_cached_movies_classic ON cached_movies(is_classic) WHERE is_classic = TRUE;
CREATE INDEX IF NOT EXISTS idx_cached_movies_year ON cached_movies(year DESC);
CREATE INDEX IF NOT EXISTS idx_cached_movies_updated ON cached_movies(updated_at DESC);

-- ============================================
-- 10. 初始化数据
-- ============================================
-- 插入永久使用的注册码（用于测试和生产环境）
INSERT INTO registration_codes (code, unlimited_use, is_active) 
VALUES ('202300210001', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 说明
-- ============================================
-- 1. 所有表使用 UUID 作为主键，避免 ID 冲突
-- 2. 外键使用 ON DELETE CASCADE/SET NULL 保证数据一致性
-- 3. 索引只创建实际查询需要的，避免过度索引
-- 4. 使用部分索引（WHERE 条件）提高查询效率
-- 5. 时间字段使用 TIMESTAMP WITH TIME ZONE 支持时区
-- 6. JSONB 类型用于存储灵活的 JSON 数据（词性、表达数据等）
