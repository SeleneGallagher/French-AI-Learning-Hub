/**
 * DeepSeek AI服务
 * 用于AI助手以外的所有模块（新闻、语用等）
 * 现在通过后端API代理调用，不直接使用API密钥
 */

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
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.message || `DeepSeek API错误: ${response.status}`;
            throw new Error(errorMsg);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'DeepSeek API调用失败');
        }
        
        const content = result.content || '';
        
        // 处理流式响应（简化版）
        if (onStream && content) {
            // 模拟流式输出
            for (let i = 0; i < content.length; i += 5) {
                const chunk = content.slice(i, i + 5);
                if (onStream) onStream(chunk, false);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            if (onStream) onStream('', true);
        }
        
        return content;
        
    } catch (error) {
        console.error('DeepSeek API调用失败:', error);
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
