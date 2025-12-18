/**
 * 每日新闻模块
 */

import { getNews } from '../services/newsService.js';
import { showError, hideLoading, showLoading } from '../utils/helpers.js';
import { translateText } from '../services/translationService.js';

let currentNews = [];

/**
 * 初始化新闻模块
 */
export async function initNews() {
    const loadingEl = document.getElementById('news-loading');
    const errorEl = document.getElementById('news-error');
    const listEl = document.getElementById('news-list');

    try {
        showLoading(loadingEl);
        errorEl.classList.add('hidden');

        const news = await getNews(10);
        currentNews = news;
        renderNews(news);

        hideLoading(loadingEl);
    } catch (error) {
        hideLoading(loadingEl);
        const errorMessage = error.message || '未知错误';
        showError(errorEl, `新闻获取失败：${errorMessage}。请检查网络连接或稍后重试。`);
        console.error('新闻获取失败:', error);
    }
}

/**
 * 渲染新闻列表
 */
function renderNews(news) {
    const listEl = document.getElementById('news-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';

    if (news.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center py-8">暂无新闻</p>';
        return;
    }

    news.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'news-card bg-white rounded-lg shadow-md p-6 mb-6 hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500 cursor-pointer';
        
        // 点击整个卡片跳转
        card.addEventListener('click', () => {
            window.open(item.link, '_blank');
        });
        
        // 来源徽章颜色
        const sourceColors = {
            'F24': 'bg-blue-500',
            'franceinfo': 'bg-red-500',
            '20 Minutes': 'bg-green-500',
            'RFI': 'bg-purple-500',
            'France Bleu': 'bg-yellow-500',
            'Le Monde': 'bg-indigo-500'
        };
        
        const sourceColor = sourceColors[item.source] || 'bg-gray-400';
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1 mr-4">
                    <h3 class="text-lg font-bold text-gray-800 mb-1 hover:text-blue-600 transition-colors leading-tight">
                        ${item.title}
                    </h3>
                    <div class="news-translation text-sm text-gray-500 mb-2"></div>
                </div>
                <span class="px-3 py-1 ${sourceColor} text-white text-xs font-semibold rounded-full whitespace-nowrap shadow-sm flex-shrink-0">
                    ${item.source}
                </span>
            </div>
            <p class="text-gray-600 mb-3 leading-relaxed text-sm">${item.description}</p>
            <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                <span class="text-xs text-gray-400">${item.formattedDate}</span>
                <span class="text-xs text-gray-400">点击卡片查看原文</span>
            </div>
        `;
        
        listEl.appendChild(card);
        
        // 异步加载标题翻译
        const translationEl = card.querySelector('.news-translation');
        loadTitleTranslation(item, translationEl);
    });
}

/**
 * 加载标题翻译
 */
async function loadTitleTranslation(newsItem, translationEl) {
    try {
        const translatedTitle = await translateText(newsItem.title, 'fr', 'zh');
        
        // 如果翻译结果与原文相同，不显示
        if (translatedTitle === newsItem.title) {
            translationEl.remove();
            return;
        }
        
        // 简洁显示翻译
        translationEl.textContent = translatedTitle;
        newsItem.translatedTitle = translatedTitle;
    } catch (error) {
        console.debug('加载标题翻译失败:', error.message);
        translationEl.remove();
    }
}
