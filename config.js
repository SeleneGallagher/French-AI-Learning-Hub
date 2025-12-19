// 配置文件 - 如果某些API未配置，相关功能将使用默认值或禁用
// 生产环境建议通过Vercel环境变量配置

// 从window对象获取环境变量（Vercel会在构建时注入）
const getEnvVar = (name) => {
    if (typeof window !== 'undefined' && window.__ENV__) {
        return window.__ENV__[name] || '';
    }
    return '';
};

export const config = {
    coze: {
        // 你的机器人ID - 通过Vercel环境变量配置
        bot_id: getEnvVar('COZE_BOT_ID') || '',
        // 你的访问令牌 - 通过Vercel环境变量配置
        access_token: getEnvVar('COZE_ACCESS_TOKEN') || '',
        // API基础URL
        api_base: 'https://api.coze.cn/v3'
    },
    cors_proxy: 'https://api.allorigins.win/get?url=',
    // 新闻RSS源
    news_sources: [
        'https://www.france24.com/fr/rss'
    ],
    // TMDB API配置（可选，用于获取电影海报）
    // 免费注册：https://www.themoviedb.org/settings/api
    // 注册后获取API密钥，填入下面的tmdb_api_key
    tmdb_api_key: getEnvVar('TMDB_API_KEY') || ''
};
