/**
 * DeepSeek AI服务
 * 用于AI助手以外的所有模块（新闻、语用等）
 * 现在通过后端API代理调用，不直接使用API密钥
 */

import { simulateStream, handleAPIError, Logger } from '../utils/helpers.js';

/**
 * 调用DeepSeek API - 通过后端代理
 * @param {string} prompt - 提示词
 * @param {Function} onStream - 流式响应回调（可选）
 * @returns {Promise<string>} AI回复
 */
export async function callDeepSeek(prompt, onStream = null) {
    const url = '/api/ai/deepseek';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                model: 'deepseek-chat'
            })
        });

        if (!response.ok) {
            throw await handleAPIError(response, 'DeepSeek API错误');
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'DeepSeek API调用失败');
        }
        
        const content = result.content || '';
        
        // 处理流式响应
        if (onStream && content) {
            await simulateStream(content, onStream);
        }
        
        return content;
        
    } catch (error) {
        Logger.error('DeepSeek API调用失败:', error);
        throw error;
    }
}

/**
 * 调用DeepSeek生成内容（非流式）
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} AI回复
 */
export async function generateWithDeepSeek(prompt) {
    return await callDeepSeek(prompt);
}
