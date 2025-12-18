/**
 * 统一翻译服务 - 带节流和缓存
 */

const CACHE_KEY = 'translation_cache';
const MAX_CACHE_SIZE = 200;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2秒间隔

/**
 * 获取翻译缓存
 */
function getCache() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
        return {};
    }
}

/**
 * 保存翻译缓存
 */
function saveCache(cache) {
    try {
        // 限制缓存大小
        const keys = Object.keys(cache);
        if (keys.length > MAX_CACHE_SIZE) {
            const toDelete = keys.slice(0, keys.length - MAX_CACHE_SIZE);
            toDelete.forEach(k => delete cache[k]);
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
}

/**
 * 等待节流
 */
async function waitForThrottle() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();
}

/**
 * 使用Google翻译（更稳定，无严格限制）
 */
async function translateWithGoogle(text, from = 'fr', to = 'zh') {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data[0] && data[0][0]) {
                return data[0].map(item => item[0]).join('');
            }
        }
    } catch {}
    return null;
}

/**
 * 使用MyMemory翻译（备用）
 */
async function translateWithMyMemory(text, from = 'fr', to = 'zh') {
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=${from}|${to}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const result = data?.responseData?.translatedText;
            if (result && !result.includes('MYMEMORY WARNING') && !result.includes('PLEASE CONTACT')) {
                return result;
            }
        }
    } catch {}
    return null;
}

/**
 * 翻译文本（主入口）
 */
export async function translateText(text, from = 'fr', to = 'zh') {
    if (!text || !text.trim()) return text;
    
    // 截取文本避免过长
    const truncatedText = text.length > 300 ? text.substring(0, 300) + '...' : text;
    
    // 检查缓存
    const cacheKey = `${from}_${to}_${truncatedText.substring(0, 50)}`;
    const cache = getCache();
    if (cache[cacheKey]) {
        return cache[cacheKey];
    }
    
    // 节流等待
    await waitForThrottle();
    
    // 优先使用Google翻译（更稳定）
    let result = await translateWithGoogle(truncatedText, from, to);
    
    // 如果Google失败，尝试MyMemory
    if (!result || result === truncatedText) {
        await new Promise(r => setTimeout(r, 500));
        result = await translateWithMyMemory(truncatedText, from, to);
    }
    
    // 保存到缓存
    if (result && result !== truncatedText) {
        cache[cacheKey] = result;
        saveCache(cache);
        return result;
    }
    
    return text;
}
