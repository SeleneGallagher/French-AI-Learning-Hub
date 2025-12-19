// 配置文件 - 所有API密钥现在通过后端API获取，不在此文件中配置
// 前端只保留非敏感配置

export const config = {
    cors_proxy: 'https://api.allorigins.win/get?url=',
    // 新闻RSS源
    news_sources: [
        'https://www.france24.com/fr/rss'
    ],
    // API配置现在通过后端获取，不在此处配置
    // 所有需要API密钥的调用都通过后端API代理
};
