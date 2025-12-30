/**
 * 语用积累模块
 */

import { saveExpression, getAllExpressions, deleteExpression as deleteExpressionFromDB } from '../services/storage.js';
import { showLoading, hideLoading } from '../utils/helpers.js';
import { generateWithDeepSeek } from '../services/deepseekService.js';
import { getAllFavorites, toggleFavorite as toggleFavoriteStorage, isFavorite, removeFavorite, saveAllFavorites } from '../services/favoritesStorage.js';
import { showConfirm } from '../utils/confirmDialog.js';

let isInFavoritesView = false;

/**
 * 初始化语用积累模块
 */
export async function initExpressions() {
    const generateBtn = document.getElementById('generate-expression-btn');
    const inputEl = document.getElementById('expression-input');
    const viewFavoritesBtn = document.getElementById('view-favorites-btn');
    const clearExpressionsBtn = document.getElementById('clear-expressions-btn');

    if (!generateBtn || !inputEl) return;

    generateBtn.addEventListener('click', async () => {
        const scenario = inputEl.value.trim();
        if (!scenario) {
            alert('请输入学习场景');
            return;
        }
        await generateExpression(scenario);
        inputEl.value = '';
    });

    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateBtn.click();
        }
    });

    if (viewFavoritesBtn) {
        viewFavoritesBtn.addEventListener('click', toggleFavoritesView);
    }

    if (clearExpressionsBtn) {
        clearExpressionsBtn.addEventListener('click', handleClearClick);
    }

    await loadExpressions();
}

/**
 * 处理清除按钮点击
 */
async function handleClearClick(e) {
    const clearBtn = document.getElementById('clear-expressions-btn');
    const confirmed = await showConfirm('确定清除？', clearBtn);
    if (!confirmed) return;

    if (isInFavoritesView) {
        saveAllFavorites([]);
        loadFavorites();
    } else {
        const expressions = await getAllExpressions();
        for (const expr of expressions) {
            await deleteExpressionFromDB(expr.id);
        }
        await loadExpressions();
    }
}

/**
 * 切换收藏夹视图
 */
function toggleFavoritesView() {
    const viewFavoritesBtn = document.getElementById('view-favorites-btn');
    const expressionsList = document.getElementById('expressions-list');
    const favoritesSection = document.getElementById('favorites-section');
    const clearExpressionsBtn = document.getElementById('clear-expressions-btn');
    
    if (isInFavoritesView) {
        isInFavoritesView = false;
        if (viewFavoritesBtn) {
            viewFavoritesBtn.innerHTML = '<span>⭐</span><span>收藏夹</span>';
            viewFavoritesBtn.className = 'px-4 py-2 rounded transition-colors text-sm flex items-center gap-1';
            viewFavoritesBtn.style.cssText = 'background-color: var(--accent-600); color: white;';
        }
        if (expressionsList) expressionsList.classList.remove('hidden');
        if (favoritesSection) favoritesSection.classList.add('hidden');
        if (clearExpressionsBtn) clearExpressionsBtn.textContent = '清除所有记录';
        loadExpressions();
    } else {
        isInFavoritesView = true;
        if (viewFavoritesBtn) {
            viewFavoritesBtn.innerHTML = '<span>←</span><span>返回</span>';
            viewFavoritesBtn.className = 'px-4 py-2 rounded transition-colors text-sm flex items-center gap-1';
            viewFavoritesBtn.style.cssText = 'background-color: var(--gray-500); color: white;';
        }
        if (expressionsList) expressionsList.classList.add('hidden');
        if (favoritesSection) favoritesSection.classList.remove('hidden');
        if (clearExpressionsBtn) clearExpressionsBtn.textContent = '清空收藏夹';
        loadFavorites();
    }
}

/**
 * 生成表达
 */
async function generateExpression(scenario) {
    const loadingEl = document.getElementById('expressions-loading');

    try {
        showLoading(loadingEl);
        
        const prompt = `你是法语学习助手。根据场景生成4-6个实用法语句子。要求：
1. 每句包含：法语原文、逐字直译、中文翻译
2. 提供文化提示
3. JSON格式返回：{"expressions":[{"french":"","literal":"","translation":""}],"cultural_tips":""}
4. 必须生成至少4个表达，最好5-6个

场景：${scenario}

直接返回JSON，确保expressions数组包含至少4个元素。`;

        let aiResponse = '';
        try {
            aiResponse = await generateWithDeepSeek(prompt);
        } catch (e) {
            const fallback = generateFallbackExpressions(scenario);
            await saveExpressionData(scenario, fallback, '这些是常用表达。');
            hideLoading(loadingEl);
            return;
        }
        
        const parsed = parseAIResponse(aiResponse);
        await saveExpressionData(scenario, parsed.expressions, parsed.cultural_tips);
        hideLoading(loadingEl);
        
    } catch (error) {
        hideLoading(loadingEl);
        alert(`生成失败：${error.message}`);
    }
}

async function saveExpressionData(scenario, expressions, tips) {
    await saveExpression({
        scenario,
        expressions,
        cultural_tips: tips,
        createdAt: new Date().toISOString(),
        id: Date.now()
    });
    await loadExpressions();
}

function generateFallbackExpressions(scenario) {
    const templates = {
        '咖啡馆': [
            { french: "Je voudrais un café, s'il vous plaît.", literal: "我想要一杯咖啡，请。", translation: "请给我一杯咖啡。" },
            { french: "L'addition, s'il vous plaît.", literal: "账单，请。", translation: "请结账。" }
        ],
        '餐厅': [
            { french: "Je voudrais réserver une table.", literal: "我想要预订一张桌子。", translation: "我想预订。" },
            { french: "La carte, s'il vous plaît.", literal: "菜单，请。", translation: "请给我菜单。" }
        ]
    };
    
    for (const [key, expressions] of Object.entries(templates)) {
        if (scenario.toLowerCase().includes(key)) {
            return expressions;
        }
    }
    
    return [
        { french: "Bonjour, comment allez-vous ?", literal: "你好，你怎么样？", translation: "你好吗？" },
        { french: "Je ne comprends pas.", literal: "我不理解。", translation: "我不明白。" }
    ];
}

function parseAIResponse(response) {
    try {
        const jsonStr = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.expressions && Array.isArray(parsed.expressions)) {
                return parsed;
            }
        }
    } catch (e) {}
    return { expressions: [{ french: response, literal: '', translation: response }], cultural_tips: '' };
}

/**
 * 加载所有表达
 */
async function loadExpressions() {
    const listEl = document.getElementById('expressions-list');
    if (!listEl) return;
    
    const expressions = await getAllExpressions();
    listEl.innerHTML = '';

    if (expressions.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center py-8">暂无积累的表达，开始生成第一个吧！</p>';
        return;
    }

    expressions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    expressions.forEach(expr => {
        listEl.appendChild(createExpressionCard(expr, false));
    });
}

function createExpressionCard(expr, isFavView) {
    const card = document.createElement('div');
    card.className = 'card p-6 mb-4';
    if (isFavView) {
        card.style.borderLeft = '4px solid var(--accent-500)';
    }
    
    const isFav = isFavorite(expr.id);
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <h3 class="text-xl font-bold" style="color: var(--gray-800);">${expr.scenario || '未命名场景'}</h3>
            <div class="flex items-center gap-2">
                <span class="text-xs" style="color: var(--gray-500);">${expr.createdAt ? new Date(expr.createdAt).toLocaleString('zh-CN') : ''}</span>
                ${!isFavView ? `<button class="favorite-btn" style="color: var(--accent-600);" data-id="${expr.id}">${isFav ? '⭐' : '☆'}</button>` : ''}
                <button class="delete-btn" style="color: var(--error);" data-id="${expr.id}" data-fav="${isFavView}">🗑️</button>
            </div>
        </div>
        <div class="space-y-3 mb-4">
            ${(expr.expressions || []).map(exp => `
                <div class="pl-4 py-2" style="border-left: 4px solid var(--primary-700);">
                    <p class="text-lg font-medium mb-1" style="color: var(--gray-800);">${exp.french || ''}</p>
                    ${exp.literal ? `<p class="text-sm mb-1 italic" style="color: var(--gray-600);">直译：${exp.literal}</p>` : ''}
                    <p style="color: var(--gray-700);">${exp.translation || ''}</p>
                </div>
            `).join('')}
        </div>
        ${expr.cultural_tips ? `<div class="rounded p-3" style="background-color: var(--accent-50); border: 1px solid var(--accent-200);"><p class="text-sm" style="color: var(--accent-800);"><strong>💡</strong> ${expr.cultural_tips}</p></div>` : ''}
    `;
    
    // 绑定收藏按钮
    const favBtn = card.querySelector('.favorite-btn');
    if (favBtn) {
        favBtn.addEventListener('click', async () => {
            const allExpr = await getAllExpressions();
            const target = allExpr.find(e => e.id === expr.id);
            if (target) {
                toggleFavoriteStorage(target);
                await loadExpressions();
            }
        });
    }
    
    // 绑定删除按钮
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmed = await showConfirm('确定删除？', deleteBtn);
            if (confirmed) {
                if (deleteBtn.dataset.fav === 'true') {
                    removeFavorite(expr.id);
                    loadFavorites();
                } else {
                    await deleteExpressionFromDB(expr.id);
                    await loadExpressions();
                }
            }
        });
    }
    
    return card;
}

/**
 * 加载收藏夹
 */
function loadFavorites() {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;
    
    const favorites = getAllFavorites();
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p class="text-center py-8" style="color: var(--gray-500);">收藏夹为空</p>';
        return;
    }
    
    favorites.sort((a, b) => new Date(b.favoritedAt || 0) - new Date(a.favoritedAt || 0));
    
    favorites.forEach(expr => {
        favoritesList.appendChild(createExpressionCard(expr, true));
    });
}

// 同步语用收藏夹（从服务器）
window.syncExpressionFavorites = function(serverFavorites) {
    if (!Array.isArray(serverFavorites) || serverFavorites.length === 0) return;
    
    const localFavorites = getAllFavorites();
    const favoritesMap = new Map();
    
    // 先添加本地收藏
    localFavorites.forEach(fav => {
        if (fav.id) {
            favoritesMap.set(fav.id, fav);
        }
    });
    
    // 再添加服务器收藏（覆盖本地）
    serverFavorites.forEach(serverFav => {
        const exprData = serverFav.expression_data || {};
        if (exprData.id) {
            favoritesMap.set(exprData.id, {
                ...exprData,
                favoritedAt: serverFav.favorited_at || new Date().toISOString()
            });
        }
    });
    
    // 保存合并后的收藏
    const mergedFavorites = Array.from(favoritesMap.values());
    saveAllFavorites(mergedFavorites);
    
    // 如果当前在收藏夹视图，刷新显示
    if (isInFavoritesView) {
        loadFavorites();
    }
    
    console.log('语用收藏夹同步完成');
};
