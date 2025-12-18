/**
 * 扣子平台API服务封装
 */

import { config } from '../../config.js';
import { localStorageService } from './storage.js';

const USER_ID_KEY = 'coze_user_id';
const CONVERSATION_ID_KEY = 'coze_conversation_id';

function getUserId() {
    let userId = localStorageService.get(USER_ID_KEY);
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorageService.set(USER_ID_KEY, userId);
    }
    return userId;
}

function getConversationId() {
    return localStorageService.get(CONVERSATION_ID_KEY, '');
}

function saveConversationId(conversationId) {
    if (conversationId) {
        localStorageService.set(CONVERSATION_ID_KEY, conversationId);
    }
}

export function clearChatContext() {
    localStorageService.remove(CONVERSATION_ID_KEY);
}

/**
 * 调用扣子API进行对话
 */
export async function callCozeAPI(prompt, onStream = null) {
    if (!config?.coze?.bot_id) {
        throw new Error('请先配置扣子API的bot_id');
    }
    
    const authToken = config.coze.pat_token || config.coze.access_token;
    if (!authToken) {
        throw new Error('请先配置扣子API的pat_token');
    }

    const url = `${config.coze.api_base || 'https://api.coze.cn/v3'}/chat`;
    const userId = getUserId();

    const requestBody = {
        bot_id: config.coze.bot_id,
        user_id: userId,
        stream: true,
        auto_save_history: true,
        additional_messages: [
            {
                role: 'user',
                content: prompt,
                content_type: 'text'
            }
        ]
    };

    const conversationId = getConversationId();
    if (conversationId) {
        requestBody.conversation_id = conversationId;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.msg || errorData.message || `API错误: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
        let buffer = '';
        let fullResponse = '';
        let lastContent = ''; // 用于去重
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
                // UTF-8 多字节序列开始字节: 110xxxxx, 1110xxxx, 11110xxx
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
                if (!line.trim() || line.startsWith('event:')) continue;
                
                if (line.startsWith('data:')) {
                    try {
                        const jsonStr = line.slice(5).trim();
                        if (jsonStr === '[DONE]') {
                            if (onStream) onStream('', true);
                            return fullResponse;
                        }
                        
                        const data = JSON.parse(jsonStr);
                        
                        if (data.conversation_id) {
                            saveConversationId(data.conversation_id);
                        }
                        
                        // 只处理answer类型，且内容不重复
                        if (data.type === 'answer' && data.content) {
                            // 检查是否是增量内容
                            if (!lastContent || !data.content.startsWith(lastContent)) {
                                // 这是新内容
                                const newContent = data.content;
                                if (newContent !== fullResponse) {
                                    const delta = newContent.slice(fullResponse.length);
                                    if (delta) {
                                        fullResponse = newContent;
                                        if (onStream) onStream(delta, false);
                                    }
                                }
                            }
                            lastContent = data.content;
                        }
                        
                        if (data.type === 'done' || data.event === 'done') {
                            if (onStream) onStream('', true);
                            return fullResponse;
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }

        if (onStream) onStream('', true);
        return fullResponse;
        
    } catch (error) {
        console.error('扣子API调用失败:', error);
        throw error;
    }
}
