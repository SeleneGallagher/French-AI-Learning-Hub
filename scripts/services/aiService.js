/**
 * AI服务 - 统一接口（仅支持扣子和DeepSeek）
 * 现在通过后端API代理，不直接使用配置
 */

/**
 * 调用AI生成内容（流式）
 */
export async function generateWithAIStream(prompt, onChunk, module = 'ai-assistant') {
    // AI助手模块使用扣子API
    if (module === 'ai-assistant') {
        try {
            const { callCozeAPI } = await import('./api.js');
            return await callCozeAPI(prompt, onChunk);
        } catch (error) {
            throw new Error('扣子API未配置或调用失败: ' + error.message);
        }
    }
    
    // 其他模块使用DeepSeek
    try {
        const { callDeepSeek } = await import('./deepseekService.js');
        return await callDeepSeek(prompt, onChunk);
    } catch (error) {
        throw new Error('DeepSeek API未配置或调用失败: ' + error.message);
    }
}

/**
 * 调用AI（非流式）
 */
export async function generateWithAI(prompt) {
    try {
        const { generateWithDeepSeek } = await import('./deepseekService.js');
        return await generateWithDeepSeek(prompt);
    } catch (error) {
        throw new Error('DeepSeek API未配置或调用失败: ' + error.message);
    }
}
