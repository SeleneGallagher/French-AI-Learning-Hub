/**
 * AI服务 - 统一接口（仅支持扣子和DeepSeek）
 */

import { config } from '../../config.js';

/**
 * 调用AI生成内容（流式）
 */
export async function generateWithAIStream(prompt, onChunk, module = 'ai-assistant') {
    // AI助手模块使用扣子API
    if (module === 'ai-assistant') {
        const cozeToken = config.coze?.pat_token || config.coze?.access_token;
        if (config.coze?.bot_id && cozeToken) {
            const { callCozeAPI } = await import('./api.js');
            return await callCozeAPI(prompt, onChunk);
        }
        throw new Error('扣子API未配置');
    }
    
    // 其他模块使用DeepSeek
    if (config.ai?.deepseek_api_key && config.ai.deepseek_api_key !== 'YOUR_DEEPSEEK_API_KEY') {
        const { callDeepSeek } = await import('./deepseekService.js');
        return await callDeepSeek(prompt, onChunk);
    }
    
    throw new Error('未配置可用的AI服务（需要DeepSeek API Key）');
}

/**
 * 调用AI（非流式）
 */
export async function generateWithAI(prompt) {
    if (config.ai?.deepseek_api_key && config.ai.deepseek_api_key !== 'YOUR_DEEPSEEK_API_KEY') {
        const { generateWithDeepSeek } = await import('./deepseekService.js');
        return await generateWithDeepSeek(prompt);
    }
    
    throw new Error('未配置可用的AI服务（需要DeepSeek API Key）');
}
