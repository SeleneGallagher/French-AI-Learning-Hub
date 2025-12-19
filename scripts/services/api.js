/**
 * 扣子平台API服务封装 - 通过后端代理
 */

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
 * 调用扣子API进行对话 - 通过后端代理
 */
export async function callCozeAPI(prompt, onStream = null) {
    const userId = getUserId();
    const conversationId = getConversationId();
    
    // 通过后端API代理调用Coze
    try {
        const response = await fetch('/api/ai/coze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                user_id: userId,
                conversation_id: conversationId || undefined
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API错误: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Coze API调用失败');
        }
        
        // 保存conversation_id
        if (result.conversation_id) {
            saveConversationId(result.conversation_id);
        }
        
        // 处理流式响应（简化版，后端返回完整内容）
        const content = result.content || '';
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
        console.error('扣子API调用失败:', error);
        throw error;
    }
}
