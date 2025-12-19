/**
 * 配置服务 - 从后端API获取配置
 */
let cachedConfig = null;

/**
 * 获取配置
 */
export async function getConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();
            cachedConfig = data;
            return data;
        }
    } catch (error) {
        console.warn('无法从后端获取配置，使用默认配置:', error);
    }
    
    // 返回默认配置
    return {
        coze: {
            bot_id: '',
            api_base: 'https://api.coze.cn/v3',
            has_token: false
        },
        tmdb: {
            has_key: false
        },
        deepseek: {
            has_key: false
        }
    };
}

/**
 * 清除缓存（用于重新加载配置）
 */
export function clearConfigCache() {
    cachedConfig = null;
}

