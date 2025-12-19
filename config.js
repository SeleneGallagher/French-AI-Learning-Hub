// 配置文件 - 如果某些API未配置，相关功能将使用默认值或禁用
// 生产环境建议通过环境变量配置

export const config = {
    coze: {
        // 你的机器人ID
        bot_id: process.env?.COZE_BOT_ID || '',
        // 你的访问令牌
        access_token: process.env?.COZE_ACCESS_TOKEN || '',
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
    tmdb_api_key: process.env?.TMDB_API_KEY || ''
};
