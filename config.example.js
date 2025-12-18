// 扣子平台API配置示例文件
// 请复制此文件为 config.js 并填写你的实际凭证

export const config = {
    coze: {
        // 你的机器人ID
        bot_id: 'YOUR_BOT_ID',
        // 你的访问令牌
        access_token: 'YOUR_ACCESS_TOKEN',
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
    tmdb_api_key: ''  // 留空则使用AI生成推荐语和占位图
};
