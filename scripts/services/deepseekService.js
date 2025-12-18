/**
 * DeepSeek AI服务
 * 用于AI助手以外的所有模块（新闻、语用等）
 */

import { config } from '../../config.js';

/**
 * 调用DeepSeek API
 * @param {string} prompt - 提示词
 * @param {Function} onStream - 流式响应回调（可选）
 * @returns {Promise<string>} AI回复
 */
export async function callDeepSeek(prompt, onStream = null) {
    if (!config.ai?.deepseek_api_key) {
        throw new Error('DeepSeek API Key未配置');
    }

    // 验证API key格式
    const apiKey = config.ai.deepseek_api_key.trim();
    if (!apiKey || apiKey === 'YOUR_DEEPSEEK_API_KEY' || !apiKey.startsWith('sk-')) {
        throw new Error('DeepSeek API Key格式不正确或未配置');
    }

    const url = 'https://api.deepseek.com/v1/chat/completions';
    
    // 确保每次都是独立对话，不读取历史（只包含当前prompt，不包含历史消息）
    const requestBody = {
        model: config.ai.deepseek_model || 'deepseek-chat',
        messages: [
            { role: 'user', content: prompt }
        ],
        temperature: 1.3, // 根据DeepSeek文档，翻译和一般对话推荐使用1.3
        stream: !!onStream,
        max_tokens: 2000,
        // 确保不读取历史对话
        presence_penalty: 0,
        frequency_penalty: 0
    };

    try {
        if (onStream) {
            // 流式响应
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error?.message || errorData.message || errorData.msg || `DeepSeek API错误: ${response.status}`;
                throw new Error(errorMsg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
            let buffer = '';
            let fullResponse = '';
            let byteBuffer = new Uint8Array();

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 处理剩余字节
                    if (byteBuffer.length > 0) {
                        buffer += decoder.decode(byteBuffer, { stream: false });
                    }
                    break;
                }

                // 合并字节缓冲区
                const combined = new Uint8Array(byteBuffer.length + value.length);
                combined.set(byteBuffer);
                combined.set(value, byteBuffer.length);
                
                // 解码并保留可能不完整的最后几个字节
                let decoded = '';
                let validLength = combined.length;
                
                // 检查最后3个字节，如果是UTF-8多字节序列的一部分，保留下次处理
                for (let i = Math.max(0, combined.length - 3); i < combined.length; i++) {
                    const byte = combined[i];
                    // UTF-8 多字节序列开始字节
                    if ((byte & 0xE0) === 0xC0 || (byte & 0xF0) === 0xE0 || (byte & 0xF8) === 0xF0) {
                        validLength = i;
                        break;
                    }
                }
                
                if (validLength > 0) {
                    decoded = decoder.decode(combined.slice(0, validLength), { stream: true });
                    byteBuffer = combined.slice(validLength);
                } else {
                    byteBuffer = combined;
                }
                
                buffer += decoded;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    if (line.trim() === 'data: [DONE]') {
                        onStream('', true);
                        return fullResponse;
                    }

                    try {
                        const jsonStr = line.slice(6).trim();
                        const data = JSON.parse(jsonStr);
                        const content = data.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            onStream(content, false);
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }

            onStream('', true);
            return fullResponse;
        } else {
            // 非流式响应
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorData = {};
                try {
                    const text = await response.text();
                    errorData = text ? JSON.parse(text) : {};
                } catch (e) {
                    errorData = { status: response.status, statusText: response.statusText };
                }
                
                const errorMsg = errorData.error?.message || errorData.message || errorData.msg || 
                    (response.status === 401 ? 'API Key无效或已过期，请检查配置' :
                     response.status === 429 ? '请求频率过高，请稍后重试' :
                     response.status === 500 ? 'DeepSeek服务器错误，请稍后重试' :
                     `DeepSeek API错误: ${response.status}`);
                
                throw new Error(errorMsg);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            
            if (!content) {
                throw new Error('DeepSeek API返回空内容');
            }
            
            return content;
        }
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

