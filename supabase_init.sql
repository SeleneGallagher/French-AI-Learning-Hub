-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- 注册码表
CREATE TABLE registration_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    used_by_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    unlimited_use BOOLEAN DEFAULT FALSE  -- 是否可无限使用
);

-- 词典查询历史
CREATE TABLE dict_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    searched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dict_history_user ON dict_history(user_id, searched_at DESC);

-- 词典收藏
CREATE TABLE dict_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    word_data TEXT,
    favorited_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, word)
);

-- 背单词进度
CREATE TABLE vocab_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    quality INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    last_review TIMESTAMP,
    next_review TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, word)
);

-- 语用表达记录
CREATE TABLE expressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,
    expression_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 语用表达收藏
CREATE TABLE expression_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expression_id UUID REFERENCES expressions(id) ON DELETE CASCADE,
    favorited_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, expression_id)
);

-- AI聊天记录
CREATE TABLE ai_chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(100),
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_user_conversation ON ai_chat_history(user_id, conversation_id);

-- 影视收藏
CREATE TABLE movie_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    movie_data TEXT,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

-- 插入无限使用的注册码（所有人都可以用，用后不失效）
INSERT INTO registration_codes (code, unlimited_use) VALUES 
    ('PUBLIC_CODE', TRUE);

-- ============================================
-- 第4步：启用Row Level Security (RLS)
-- ============================================
-- RLS是Supabase的安全机制，确保用户只能访问自己的数据
-- 我们在后端使用service_role key来绕过RLS（因为后端已经验证了用户身份）
-- 所以这里只需要启用RLS，不需要创建复杂的策略

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE expressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expression_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_favorites ENABLE ROW LEVEL SECURITY;

