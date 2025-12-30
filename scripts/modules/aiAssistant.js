/**
 * AI助手模块
 */

import { clearChatContext } from '../services/api.js';
import { generateWithAIStream } from '../services/aiService.js';
import { localStorageService } from '../services/storage.js';
import { showConfirm } from '../utils/confirmDialog.js';

const CHAT_HISTORY_KEY = 'ai_chat_history';
const MAX_HISTORY_LENGTH = 50;

let chatHistory = [];

/**
 * 初始化AI助手模块
 */
export function initAIAssistant() {
    loadChatHistory();
    
    if (chatHistory.length > 0) {
        renderChatHistory();
    }

    const sendBtn = document.getElementById('chat-send-btn');
    const inputEl = document.getElementById('chat-input');
    const clearBtn = document.getElementById('chat-clear-btn');

    if (!sendBtn || !inputEl) return;

    sendBtn.addEventListener('click', sendMessage);

    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllMessages);
    }
}

function loadChatHistory() {
    try {
        const saved = localStorageService.get(CHAT_HISTORY_KEY, []);
        chatHistory = Array.isArray(saved) ? saved.slice(-MAX_HISTORY_LENGTH) : [];
    } catch (e) {
        chatHistory = [];
    }
}

function saveChatHistory() {
    try {
        localStorageService.set(CHAT_HISTORY_KEY, chatHistory);
    } catch (e) {
        // 静默失败
    }
}

function renderChatHistory() {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    const welcomeMsg = messagesEl.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    chatHistory.forEach(msg => {
        addMessageToUI(msg.role, msg.content);
    });

    scrollToBottom();
}

/**
 * 发送消息
 */
async function sendMessage() {
    const inputEl = document.getElementById('chat-input');
    const message = inputEl.value.trim();

    if (!message) return;

    addMessageToUI('user', message);
    inputEl.value = '';
    
    chatHistory.push({ role: 'user', content: message });
    saveChatHistory();

    const loadingId = addMessageToUI('assistant', '正在思考...', true);

    try {
        let fullResponse = '';
        
        await generateWithAIStream(message, (chunk, done) => {
            if (done) {
                updateMessage(loadingId, fullResponse || '（无响应）');
                if (fullResponse) {
                    chatHistory.push({ role: 'assistant', content: fullResponse });
                    saveChatHistory();
                }
            } else if (chunk) {
                fullResponse += chunk;
                updateMessage(loadingId, fullResponse + '▋');
            }
        }, 'ai-assistant');

    } catch (error) {
        console.error('AI助手错误:', error);
        updateMessage(loadingId, `❌ 错误：${error.message || '请求失败'}`);
    }
}

function addMessageToUI(role, content, isLoading = false) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return null;

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `chat-message mb-4 ${role === 'user' ? 'flex justify-end' : 'flex justify-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'inline-block max-w-3xl p-4 rounded-lg';
    if (role === 'user') {
        bubble.style.cssText = 'background-color: var(--primary-700); color: white;';
    } else {
        bubble.style.cssText = 'background-color: var(--gray-100); color: var(--gray-800);';
    }
    
    bubble.innerHTML = formatMessage(content);
    
    messageDiv.appendChild(bubble);
    messagesEl.appendChild(messageDiv);
    scrollToBottom();

    return messageId;
}

function formatMessage(content) {
    if (!content) return '';
    
    // 确保内容是字符串
    const text = String(content);
    
    // HTML 转义
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Markdown 格式化
    escaped = escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="px-1 rounded" style="background-color: var(--gray-200);">$1</code>')
        .replace(/\n/g, '<br>');
    
    return escaped;
}

function updateMessage(messageId, content) {
    const messageEl = document.getElementById(messageId);
    if (messageEl) {
        const bubble = messageEl.querySelector('div');
        if (bubble) {
            bubble.innerHTML = formatMessage(content);
            scrollToBottom();
        }
    }
}

function scrollToBottom() {
    const container = document.getElementById('chat-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

async function clearAllMessages() {
    const clearBtn = document.getElementById('chat-clear-btn');
    const confirmed = await showConfirm('确定清除？', clearBtn);
    if (!confirmed) return;
    
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
        messagesEl.innerHTML = `
            <div class="p-4 rounded-lg welcome-message" style="background-color: var(--primary-50);">
                <p style="color: var(--gray-700);">👋 你好！我是你的法语学习AI助手，可以帮你解答任何关于法语学习的问题。</p>
            </div>
        `;
    }
    
    chatHistory = [];
    saveChatHistory();
    clearChatContext();
}
