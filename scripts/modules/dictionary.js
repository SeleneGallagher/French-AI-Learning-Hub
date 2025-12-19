/**
 * 法语词典模块 - 整合词典查询和背单词功能
 * 三个面板按钮可切换：历史记录、收藏夹、背单词
 */

import { debounce } from '../utils/helpers.js';

const DICT_STORAGE_KEY = 'dict_data';
const HISTORY_KEY = 'dict_history';
const FAVORITES_KEY = 'dict_favorites';
const VOCAB_PROGRESS_KEY = 'vocab_progress';
const MAX_HISTORY = 50;

let dictData = null;
let dictWords = [];
let searchHistory = [];
let favorites = [];
let vocabProgress = {}; // { word: { quality: 0-2, count: n, lastReview: timestamp } }
let currentVocabWord = null;
let currentPanel = null; // 'history' | 'favorites' | 'vocab' | null

// 索引系统
let wordIndex = new Map();        // word.toLowerCase() -> wordObj
let prefixIndex = new Map();      // prefix -> [wordObj, ...]
let posIndex = new Map();         // pos -> [wordObj, ...]
let dictMetadata = {              // 词典元数据
    totalCount: 0,
    posCounts: {},
    loadedAt: null
};

// 初始化词典模块
export async function initDictionary() {
    // 加载本地存储
    loadLocalStorage();
    
    // 加载词典数据
    await loadDictionary();
    
    // 绑定事件
    bindEvents();
    
    // 更新UI
    updateFavoritesCount();
    updateTotalCount();
}

// 加载本地存储
function loadLocalStorage() {
    try {
        searchHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
        vocabProgress = JSON.parse(localStorage.getItem(VOCAB_PROGRESS_KEY) || '{}');
    } catch (e) {
        searchHistory = [];
        favorites = [];
        vocabProgress = {};
    }
}

// 保存历史记录
function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.slice(0, MAX_HISTORY)));
    } catch {}
}

// 保存收藏
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {}
}

// 保存学习进度
function saveVocabProgress() {
    try {
        localStorage.setItem(VOCAB_PROGRESS_KEY, JSON.stringify(vocabProgress));
    } catch {}
}

// 词典加载状态
let dictionaryLoadPromise = null;

// 构建索引系统
function buildIndexes(words) {
    wordIndex.clear();
    prefixIndex.clear();
    posIndex.clear();
    
    words.forEach(word => {
        const wordLower = word.word.toLowerCase();
        
        // 单词索引（精确匹配）
        // 如果同一个词有多个词性，合并词性信息
        if (wordIndex.has(wordLower)) {
            const existing = wordIndex.get(wordLower);
            // 合并词性
            const existingPos = new Set(existing.pos?.map(p => p.abbr || p.full) || []);
            const newPos = word.pos?.filter(p => !existingPos.has(p.abbr || p.full)) || [];
            if (newPos.length > 0) {
                existing.pos = [...(existing.pos || []), ...newPos];
            }
            // 合并定义
            const existingDefs = new Set(existing.definitions?.map(d => d.text) || []);
            const newDefs = word.definitions?.filter(d => !existingDefs.has(d.text)) || [];
            if (newDefs.length > 0) {
                existing.definitions = [...(existing.definitions || []), ...newDefs];
            }
        } else {
            wordIndex.set(wordLower, word);
        }
        
        // 前缀索引（1-5个字符，用于自动补全）
        const maxPrefixLen = Math.min(5, word.word.length);
        for (let len = 1; len <= maxPrefixLen; len++) {
            const prefix = wordLower.substring(0, len);
            if (!prefixIndex.has(prefix)) {
                prefixIndex.set(prefix, []);
            }
            const prefixList = prefixIndex.get(prefix);
            // 避免重复添加
            if (!prefixList.some(w => w.word.toLowerCase() === wordLower)) {
                prefixList.push(word);
            }
        }
        
        // 词性索引（用于按词性筛选）
        word.pos?.forEach(p => {
            const posKey = p.abbr || p.full;
            if (!posIndex.has(posKey)) {
                posIndex.set(posKey, []);
            }
            const posList = posIndex.get(posKey);
            if (!posList.some(w => w.word.toLowerCase() === wordLower)) {
                posList.push(word);
            }
        });
    });
    
    // 限制前缀索引的候选数量（每个前缀最多100个，避免内存过大）
    for (const [prefix, words] of prefixIndex.entries()) {
        if (words.length > 100) {
            prefixIndex.set(prefix, words.slice(0, 100));
        }
    }
    
    console.log(`索引构建完成: ${wordIndex.size} 个唯一词条, ${prefixIndex.size} 个前缀索引`);
}

// 加载词典（并行加载多个JSON文件）
async function loadDictionary() {
    // 如果已经在加载，返回同一个Promise
    if (dictionaryLoadPromise) {
        return dictionaryLoadPromise;
    }
    
    // 如果已经加载过，直接返回
    if (dictWords.length > 0) {
        return;
    }
    
    const loadingEl = document.getElementById('dict-loading');
    const welcomeEl = document.getElementById('dict-welcome');
    
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (welcomeEl) welcomeEl.classList.add('hidden');
    
    dictionaryLoadPromise = (async () => {
        try {
            // 优先尝试并行加载新的分词性文件
            const posFiles = ['noun', 'verb', 'adj', 'adv', 'conj', 'prep', 'pron', 'det'];
            const loadPromises = posFiles.map(pos => 
                fetch(`/public/data/dicts/${pos}.json`)
                    .then(response => {
                        if (response.ok) {
                            return response.json().then(data => ({ pos, data, success: true }));
                        }
                        return { pos, data: null, success: false };
                    })
                    .catch(() => ({ pos, data: null, success: false }))
            );
            
            const results = await Promise.all(loadPromises);
            const loadedFiles = results.filter(r => r.success);
            
            if (loadedFiles.length > 0) {
                // 合并所有词条
                dictWords = [];
                dictMetadata.posCounts = {};
                dictMetadata.totalCount = 0;
                
                loadedFiles.forEach(({ pos, data }) => {
                    const words = data.words || [];
                    dictWords.push(...words);
                    dictMetadata.posCounts[pos] = words.length;
                    dictMetadata.totalCount += words.length;
                });
                
                // 构建索引
                buildIndexes(dictWords);
                
                dictMetadata.loadedAt = new Date().toISOString();
                console.log(`词典加载成功: ${dictWords.length} 词条 (${loadedFiles.length}/${posFiles.length} 个文件)`);
            } else {
                // 如果新格式文件都不存在，尝试加载旧的统一文件
                console.log('新格式文件不存在，尝试加载旧格式...');
                let response = await fetch('/public/data/dicts/french_dict.json');
                if (!response.ok) {
                    response = await fetch('/public/data/dicts/gonggong.json');
                }
                
                if (response.ok) {
                    dictData = await response.json();
                    dictWords = dictData.words || [];
                    buildIndexes(dictWords);
                    console.log(`词典加载成功: ${dictWords.length} 词条 (旧格式)`);
                } else {
                    console.warn('词典文件不存在，词典功能将不可用');
                    dictWords = [];
                }
            }
        } catch (e) {
            console.error('加载词典失败:', e);
            dictWords = [];
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
            if (welcomeEl) welcomeEl.classList.remove('hidden');
            dictionaryLoadPromise = null; // 加载完成后清除Promise
        }
    })();
    
    return dictionaryLoadPromise;
}

// 绑定事件
function bindEvents() {
    const searchInput = document.getElementById('dict-search-input');
    const searchBtn = document.getElementById('dict-search-btn');
    const randomBtn = document.getElementById('dict-random-btn');
    const startBtn = document.getElementById('dict-start-btn');
    const clearHistoryBtn = document.getElementById('dict-clear-history-btn');
    const clearFavoritesBtn = document.getElementById('dict-clear-favorites-btn');
    
    // 搜索输入（使用防抖优化）
    if (searchInput) {
        const handleSearchInputDebounced = debounce(handleSearchInput, 200);
        searchInput.addEventListener('input', handleSearchInputDebounced);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performSearch(searchInput.value.trim());
            }
            if (e.key === 'Escape') {
                hideSuggestions();
            }
        });
        searchInput.addEventListener('focus', handleSearchInput);
    }
    
    // 搜索按钮
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            performSearch(searchInput?.value.trim());
        });
    }
    
    // 随机单词
    if (randomBtn) {
        randomBtn.addEventListener('click', showRandomWord);
    }
    
    // 开始探索
    if (startBtn) {
        startBtn.addEventListener('click', showRandomWord);
    }
    
    // 清空历史
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
    }
    
    // 清空收藏
    if (clearFavoritesBtn) {
        clearFavoritesBtn.addEventListener('click', clearFavorites);
    }
    
    // 绑定切换按钮
    bindToggleButtons();
    
    // 绑定背单词按钮
    bindVocabButtons();
    
    // 点击外部关闭建议
    document.addEventListener('click', (e) => {
        const suggestions = document.getElementById('dict-suggestions');
        const searchInput = document.getElementById('dict-search-input');
        if (suggestions && !suggestions.contains(e.target) && e.target !== searchInput) {
            hideSuggestions();
        }
    });
}

// 绑定切换按钮
function bindToggleButtons() {
    const buttons = document.querySelectorAll('.toggle-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const panelType = btn.dataset.panel;
            
            if (currentPanel === panelType) {
                // 当前面板已打开，点击关闭回到默认
                goBackToDefault();
            } else {
                // 打开新面板
                showPanel(panelType);
            }
        });
    });
}

// 显示面板
function showPanel(panelType) {
    // 重置所有按钮状态
    resetAllButtons();
    hideAllPanels();
    
    currentPanel = panelType;
    
    // 更新当前按钮激活状态
    const btn = document.querySelector(`.toggle-btn[data-panel="${panelType}"]`);
    if (btn) {
        btn.classList.add('active');
    }
    
    // 显示对应面板
    switch (panelType) {
        case 'history':
            renderHistoryPanel();
            break;
        case 'favorites':
            renderFavoritesPanel();
            break;
        case 'vocab':
            renderVocabPanel();
            break;
    }
}

// 返回默认视图
function goBackToDefault() {
    resetAllButtons();
    hideAllPanels();
    currentPanel = null;
    
    // 显示欢迎页
    const welcomeEl = document.getElementById('dict-welcome');
    if (welcomeEl) welcomeEl.classList.remove('hidden');
}

// 重置所有按钮
function resetAllButtons() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

// 使用索引优化的搜索函数
function findExactMatch(query) {
    return wordIndex.get(query.toLowerCase()) || null;
}

function findPrefixMatches(query) {
    const prefix = query.toLowerCase();
    const matches = prefixIndex.get(prefix) || [];
    // 限制结果数量，按字母顺序排序
    return matches.slice(0, 10).sort((a, b) => 
        a.word.localeCompare(b.word)
    );
}

function findFuzzyMatches(query) {
    const q = query.toLowerCase();
    const results = [];
    const seen = new Set();
    
    // 优先使用前缀索引
    if (prefixIndex.has(q)) {
        prefixIndex.get(q).forEach(word => {
            const wordLower = word.word.toLowerCase();
            if (wordLower !== q && !seen.has(wordLower)) {
                results.push(word);
                seen.add(wordLower);
            }
        });
    }
    
    // 如果结果不足，遍历单词索引（限制范围）
    if (results.length < 10) {
        for (const [word, wordObj] of wordIndex.entries()) {
            if (word.includes(q) && word !== q && !seen.has(word)) {
                results.push(wordObj);
                seen.add(word);
                if (results.length >= 10) break;
            }
        }
    }
    
    return results.slice(0, 10);
}

// 处理搜索输入（使用索引优化）
function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    if (query.length < 1) {
        hideSuggestions();
        return;
    }
    
    // 使用前缀索引快速查找
    const prefixMatches = findPrefixMatches(query);
    
    // 如果前缀匹配不足，添加模糊匹配
    let allMatches = [...prefixMatches];
    if (allMatches.length < 10) {
        const fuzzyMatches = findFuzzyMatches(query);
        const seen = new Set(prefixMatches.map(w => w.word.toLowerCase()));
        fuzzyMatches.forEach(w => {
            if (!seen.has(w.word.toLowerCase())) {
                allMatches.push(w);
            }
        });
    }
    
    showSuggestions(allMatches.slice(0, 15));
}

// 显示搜索建议
function showSuggestions(words) {
    const suggestionsEl = document.getElementById('dict-suggestions');
    if (!suggestionsEl) return;
    
    if (words.length === 0) {
        hideSuggestions();
        return;
    }
    
    suggestionsEl.innerHTML = words.map(word => {
        const shortDef = getShortDefinition(word);
        return `
            <div class="suggestion-item px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors" data-word="${word.word}">
                <div class="font-semibold text-slate-800">${word.word}</div>
                ${shortDef ? `<div class="text-sm text-slate-500 truncate">${shortDef}</div>` : ''}
            </div>
        `;
    }).join('');
    
    suggestionsEl.classList.remove('hidden');
    
    // 绑定点击事件
    suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const word = item.dataset.word;
            document.getElementById('dict-search-input').value = word;
            hideSuggestions();
            performSearch(word);
        });
    });
}

// 隐藏建议
function hideSuggestions() {
    const suggestionsEl = document.getElementById('dict-suggestions');
    if (suggestionsEl) {
        suggestionsEl.classList.add('hidden');
    }
}

// 获取简短定义
function getShortDefinition(wordObj) {
    if (!wordObj.definitions || wordObj.definitions.length === 0) return '';
    const firstDef = wordObj.definitions[0];
    let text = firstDef.text || '';
    // 移除编号
    text = text.replace(/^\d+\s*/, '').replace(/^[a-zA-Z]+\s*\([^)]*\)\s*/, '');
    if (text.length > 40) text = text.substring(0, 40) + '...';
    return text;
}

// 执行搜索（使用索引优化）
function performSearch(query) {
    if (!query) return;
    
    // 检查词典是否已加载
    if (!dictWords || dictWords.length === 0) {
        const resultsEl = document.getElementById('dict-results');
        const welcomeEl = document.getElementById('dict-welcome');
        if (welcomeEl) welcomeEl.classList.add('hidden');
        if (resultsEl) {
            resultsEl.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-slate-700 mb-2">词典未加载</h3>
                    <p class="text-slate-500">请刷新页面重试，或检查词典文件是否存在</p>
                </div>
            `;
            resultsEl.classList.remove('hidden');
        }
        return;
    }
    
    hideSuggestions();
    resetAllButtons();
    hideAllPanels();
    currentPanel = null;
    
    const resultsEl = document.getElementById('dict-results');
    const welcomeEl = document.getElementById('dict-welcome');
    
    if (welcomeEl) welcomeEl.classList.add('hidden');
    
    // 使用索引进行精确匹配（O(1)）
    const exactMatch = findExactMatch(query);
    
    // 使用索引进行模糊匹配
    const fuzzyMatches = findFuzzyMatches(query);
    
    if (!exactMatch && fuzzyMatches.length === 0) {
        if (resultsEl) {
            resultsEl.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-4">🔍</div>
                    <h3 class="text-xl font-bold text-slate-700 mb-2">未找到「${query}」</h3>
                    <p class="text-slate-500">试试其他关键词，或点击"随机"探索词典</p>
                </div>
            `;
            resultsEl.classList.remove('hidden');
        }
        return;
    }
    
    // 添加到历史记录
    addToHistory(query);
    
    // 渲染结果
    let html = '';
    
    if (exactMatch) {
        html += renderWordCard(exactMatch, true);
    }
    
    if (fuzzyMatches.length > 0) {
        html += `
            <div class="mt-8">
                <h4 class="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wide">相关词汇</h4>
                <div class="grid gap-3">
                    ${fuzzyMatches.map(w => renderWordCard(w, false)).join('')}
                </div>
            </div>
        `;
    }
    
    if (resultsEl) {
        resultsEl.innerHTML = html;
        resultsEl.classList.remove('hidden');
        bindCardEvents();
    }
}

// 渲染单词卡片
function renderWordCard(wordObj, isMain = false) {
    const isFavorite = favorites.some(f => f.word === wordObj.word);
    const posText = wordObj.pos?.map(p => `<span class="px-2 py-0.5 text-xs rounded" style="background-color: var(--primary-100); color: var(--primary-700);">${p.full || p.abbr}</span>`).join(' ') || '';
    
    // 性别标签（针对名词）
    const genderBadge = wordObj.gender ? `<span class="px-2 py-0.5 text-xs rounded font-semibold" style="background-color: var(--accent-100); color: var(--accent-700);">
        ${wordObj.gender === 'm' ? '♂ 阳性' : wordObj.gender === 'f' ? '♀ 阴性' : '♂/♀ 双性'}
    </span>` : '';
    
    // 变位信息（针对动词）
    const conjugationInfo = wordObj.conjugation ? `
        <div class="mt-4 p-3 rounded" style="background-color: var(--gray-50); border-left: 3px solid var(--primary-500);">
            <div class="text-sm font-semibold mb-2" style="color: var(--gray-700);">变位类型</div>
            <div class="text-sm" style="color: var(--gray-600);">${wordObj.conjugation}</div>
        </div>
    ` : '';
    
    if (isMain) {
        // 主卡片 - 详细展示（使用新配色系统）
        return `
            <div class="word-card card overflow-hidden" data-word="${wordObj.word}">
                <!-- 头部 - 深蓝渐变 -->
                <div class="px-6 py-4 text-white" style="background: linear-gradient(135deg, var(--primary-800) 0%, var(--primary-700) 100%);">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h2 class="text-2xl font-bold mb-1">${wordObj.word}</h2>
                            ${wordObj.phonetic ? `<div style="color: var(--primary-200);">/${wordObj.phonetic}/</div>` : ''}
                        </div>
                        <button class="favorite-btn p-2 rounded transition-colors ${isFavorite ? 'text-red-400' : 'text-white/70'}" style="background: rgba(255,255,255,0.1);" data-word="${wordObj.word}">
                            <svg class="w-5 h-5" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${posText}
                        ${genderBadge}
                    </div>
                </div>
                
                <!-- 释义 -->
                <div class="p-6">
                    ${renderDefinitions(wordObj.definitions)}
                    ${conjugationInfo}
                </div>
            </div>
        `;
    } else {
        // 简洁卡片
        const shortDef = getShortDefinition(wordObj);
        return `
            <div class="word-card-mini card p-4 cursor-pointer transition-all" data-word="${wordObj.word}">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <span class="font-bold" style="color: var(--gray-800);">${wordObj.word}</span>
                        ${posText ? `<span class="ml-2">${posText}</span>` : ''}
                        ${shortDef ? `<p class="text-sm mt-1" style="color: var(--gray-500);">${shortDef}</p>` : ''}
                    </div>
                    <svg class="w-4 h-4" style="color: var(--gray-400);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        `;
    }
}

// 渲染释义
function renderDefinitions(definitions) {
    if (!definitions || definitions.length === 0) {
        return '<p style="color: var(--gray-500); font-style: italic;">暂无释义</p>';
    }
    
    return definitions.map((def, idx) => {
        let text = def.text || '';
        // 清理文本
        text = text.replace(/^\d+\s*/, '');
        
        const examples = def.examples || [];
        
        return `
            <div class="definition-item ${idx > 0 ? 'mt-4 pt-4' : ''}" style="${idx > 0 ? 'border-top: 1px solid var(--gray-200);' : ''}">
                <div style="color: var(--gray-700);">${text}</div>
                
                ${examples.length > 0 ? `
                    <div class="mt-3 space-y-2">
                        ${examples.slice(0, 3).map(ex => `
                            <div class="pl-3 py-2 pr-3 rounded-r" style="border-left: 2px solid var(--primary-400); background-color: var(--primary-50);">
                                <div class="text-sm" style="color: var(--primary-800);">${ex.fr}</div>
                                ${ex.zh ? `<div class="text-sm mt-1" style="color: var(--gray-600);">${ex.zh}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// 绑定卡片事件
function bindCardEvents() {
    // 收藏按钮
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.word);
        });
    });
    
    // 简洁卡片点击
    document.querySelectorAll('.word-card-mini').forEach(card => {
        card.addEventListener('click', () => {
            const word = card.dataset.word;
            document.getElementById('dict-search-input').value = word;
            performSearch(word);
        });
    });
}

// 切换收藏
function toggleFavorite(word) {
    const wordObj = dictWords.find(w => w.word === word);
    if (!wordObj) return;
    
    const existingIndex = favorites.findIndex(f => f.word === word);
    
    if (existingIndex !== -1) {
        favorites.splice(existingIndex, 1);
    } else {
        favorites.unshift({
            word: wordObj.word,
            phonetic: wordObj.phonetic,
            pos: wordObj.pos,
            addedAt: new Date().toISOString()
        });
    }
    
    saveFavorites();
    updateFavoritesCount();
    
    // 更新按钮状态
    const btn = document.querySelector(`.favorite-btn[data-word="${word}"]`);
    if (btn) {
        const isFavorite = favorites.some(f => f.word === word);
        btn.classList.toggle('text-red-400', isFavorite);
        btn.classList.toggle('text-white/70', !isFavorite);
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
        }
    }
}

// 添加到历史
function addToHistory(word) {
    // 移除重复
    searchHistory = searchHistory.filter(h => h !== word);
    // 添加到开头
    searchHistory.unshift(word);
    // 限制数量
    searchHistory = searchHistory.slice(0, MAX_HISTORY);
    saveHistory();
}

// 渲染历史面板
function renderHistoryPanel() {
    const panel = document.getElementById('dict-history-panel');
    const listEl = document.getElementById('dict-history-list');
    
    if (!panel || !listEl) return;
    
    if (searchHistory.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-12" style="color: var(--gray-500);">
                <div class="text-4xl mb-3">📜</div>
                <p>暂无搜索历史</p>
            </div>
        `;
    } else {
        listEl.innerHTML = searchHistory.map(word => `
            <div class="history-item flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors card" data-word="${word}">
                <span class="font-medium" style="color: var(--gray-700);">${word}</span>
                <svg class="w-4 h-4" style="color: var(--gray-400);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </div>
        `).join('');
        
        listEl.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const word = item.dataset.word;
                document.getElementById('dict-search-input').value = word;
                performSearch(word);
            });
        });
    }
    
    panel.classList.remove('hidden');
}

// 渲染收藏面板
function renderFavoritesPanel() {
    const panel = document.getElementById('dict-favorites-panel');
    const listEl = document.getElementById('dict-favorites-list');
    
    if (!panel || !listEl) return;
    
    if (favorites.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-12" style="color: var(--gray-500);">
                <div class="text-4xl mb-3">❤️</div>
                <p>还没有收藏任何单词</p>
                <p class="text-sm mt-2">点击单词卡片上的爱心图标即可收藏</p>
            </div>
        `;
    } else {
        listEl.innerHTML = favorites.map(fav => {
            const wordObj = dictWords.find(w => w.word === fav.word);
            const posText = fav.pos?.map(p => p.full || p.abbr).join(', ') || '';
            const shortDef = wordObj ? getShortDefinition(wordObj) : '';
            
            return `
                <div class="favorite-item card p-4 cursor-pointer transition-all" data-word="${fav.word}">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="font-bold text-lg" style="color: var(--gray-800);">${fav.word}</div>
                            ${fav.phonetic ? `<div class="text-sm" style="color: var(--gray-500);">/${fav.phonetic}/</div>` : ''}
                            ${posText ? `<div class="text-xs mt-1" style="color: var(--primary-700);">${posText}</div>` : ''}
                            ${shortDef ? `<p class="text-sm mt-2" style="color: var(--gray-600);">${shortDef}</p>` : ''}
                        </div>
                        <button class="remove-favorite-btn p-2 transition-colors" style="color: var(--gray-400);" data-word="${fav.word}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 点击查看详情
        listEl.querySelectorAll('.favorite-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.remove-favorite-btn')) return;
                const word = item.dataset.word;
                document.getElementById('dict-search-input').value = word;
                performSearch(word);
            });
        });
        
        // 删除收藏
        listEl.querySelectorAll('.remove-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const word = btn.dataset.word;
                favorites = favorites.filter(f => f.word !== word);
                saveFavorites();
                updateFavoritesCount();
                renderFavoritesPanel(); // 刷新列表
            });
        });
    }
    
    panel.classList.remove('hidden');
}

// ============ 背单词功能 ============

// 渲染背单词面板
function renderVocabPanel() {
    const panel = document.getElementById('dict-vocab-panel');
    if (!panel) return;
    
    updateVocabStats();
    panel.classList.remove('hidden');
    
    // 显示空状态
    const cardEl = document.getElementById('vocab-card');
    const emptyEl = document.getElementById('vocab-empty');
    const listEl = document.getElementById('vocab-learned-list');
    
    if (cardEl) cardEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (listEl) listEl.classList.add('hidden');
}

// 绑定背单词按钮
function bindVocabButtons() {
    const nextBtn = document.getElementById('vocab-next-btn');
    const weakBtn = document.getElementById('vocab-weak-btn');
    const listBtn = document.getElementById('vocab-list-btn');
    
    if (nextBtn) {
        nextBtn.addEventListener('click', showNextVocabWord);
    }
    
    if (weakBtn) {
        weakBtn.addEventListener('click', reviewWeakWords);
    }
    
    if (listBtn) {
        listBtn.addEventListener('click', showLearnedList);
    }
    
    // 单词点击显示释义
    const wordEl = document.getElementById('vocab-word');
    if (wordEl) {
        wordEl.addEventListener('click', showVocabDefinition);
    }
    
    // 评分按钮
    document.querySelectorAll('.vocab-quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const quality = parseInt(btn.dataset.quality);
            rateVocabWord(quality);
        });
    });
}

// 更新学习统计
function updateVocabStats() {
    const totalEl = document.getElementById('vocab-total-count');
    const learnedEl = document.getElementById('vocab-learned-count');
    const masteredEl = document.getElementById('vocab-mastered-count');
    
    const learned = Object.keys(vocabProgress).length;
    const mastered = Object.values(vocabProgress).filter(p => p.quality === 2).length;
    
    if (totalEl) totalEl.textContent = dictWords.length.toLocaleString();
    if (learnedEl) learnedEl.textContent = learned;
    if (masteredEl) masteredEl.textContent = mastered;
}

// 显示下一个单词
function showNextVocabWord() {
    // 优先显示未学习的单词
    const learnedWords = new Set(Object.keys(vocabProgress));
    const unlearned = dictWords.filter(w => !learnedWords.has(w.word));
    
    let word;
    if (unlearned.length > 0) {
        word = unlearned[Math.floor(Math.random() * unlearned.length)];
    } else {
        // 所有都学过了，随机复习
        word = dictWords[Math.floor(Math.random() * dictWords.length)];
    }
    
    showVocabCard(word);
}

// 复习生疏单词
function reviewWeakWords() {
    const weakWords = Object.entries(vocabProgress)
        .filter(([_, p]) => p.quality === 0)
        .map(([word, _]) => word);
    
    if (weakWords.length === 0) {
        alert('没有生疏的单词需要复习！');
        return;
    }
    
    const randomWeak = weakWords[Math.floor(Math.random() * weakWords.length)];
    const wordObj = dictWords.find(w => w.word === randomWeak);
    
    if (wordObj) {
        showVocabCard(wordObj);
    }
}

// 显示已学列表
function showLearnedList() {
    const cardEl = document.getElementById('vocab-card');
    const emptyEl = document.getElementById('vocab-empty');
    const listEl = document.getElementById('vocab-learned-list');
    
    if (cardEl) cardEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (!listEl) return;
    
    const learnedEntries = Object.entries(vocabProgress)
        .sort((a, b) => (b[1].lastReview || 0) - (a[1].lastReview || 0));
    
    if (learnedEntries.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>还没有学习任何单词</p>
            </div>
        `;
    } else {
        listEl.innerHTML = learnedEntries.map(([word, progress]) => {
            return `
                <div class="learned-item flex items-center justify-between px-4 py-3 rounded-lg transition-colors" data-word="${word}">
                    <span class="font-medium cursor-pointer transition-colors learned-word-click" style="color: var(--gray-700);" data-word="${word}">${word}</span>
                    <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1">
                            <button class="quality-toggle w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${progress.quality === 0 ? 'text-white' : ''}" style="${progress.quality === 0 ? 'background-color: var(--error);' : 'background-color: var(--gray-100); color: var(--gray-400);'}" data-word="${word}" data-quality="0" title="生疏">😕</button>
                            <button class="quality-toggle w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${progress.quality === 1 ? 'text-white' : ''}" style="${progress.quality === 1 ? 'background-color: var(--warning);' : 'background-color: var(--gray-100); color: var(--gray-400);'}" data-word="${word}" data-quality="1" title="模糊">🤔</button>
                            <button class="quality-toggle w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${progress.quality === 2 ? 'text-white' : ''}" style="${progress.quality === 2 ? 'background-color: var(--success);' : 'background-color: var(--gray-100); color: var(--gray-400);'}" data-word="${word}" data-quality="2" title="熟练">😊</button>
                        </div>
                        <button class="remove-learned-btn w-7 h-7 rounded-full flex items-center justify-center transition-all" style="color: var(--gray-400);" data-word="${word}" title="删除记录">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 点击单词查看详情
        listEl.querySelectorAll('.learned-word-click').forEach(item => {
            item.addEventListener('click', () => {
                const word = item.dataset.word;
                const wordObj = dictWords.find(w => w.word === word);
                if (wordObj) showVocabCard(wordObj);
            });
        });
        
        // 快速切换熟练度
        listEl.querySelectorAll('.quality-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const word = btn.dataset.word;
                const quality = parseInt(btn.dataset.quality);
                
                if (vocabProgress[word]) {
                    vocabProgress[word].quality = quality;
                    vocabProgress[word].lastReview = Date.now();
                    saveVocabProgress();
                    updateVocabStats();
                    showLearnedList();
                }
            });
        });
        
        // 删除学习记录
        listEl.querySelectorAll('.remove-learned-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const word = btn.dataset.word;
                delete vocabProgress[word];
                saveVocabProgress();
                updateVocabStats();
                showLearnedList();
            });
        });
    }
    
    listEl.classList.remove('hidden');
}

// 显示单词卡片
function showVocabCard(wordObj) {
    currentVocabWord = wordObj;
    
    const cardEl = document.getElementById('vocab-card');
    const emptyEl = document.getElementById('vocab-empty');
    const listEl = document.getElementById('vocab-learned-list');
    const wordEl = document.getElementById('vocab-word');
    const detailEl = document.getElementById('vocab-detail');
    
    if (cardEl) cardEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (listEl) listEl.classList.add('hidden');
    if (detailEl) detailEl.classList.add('hidden');
    
    if (wordEl) {
        wordEl.textContent = wordObj.word;
    }
}

// 显示释义
function showVocabDefinition() {
    if (!currentVocabWord) return;
    
    const detailEl = document.getElementById('vocab-detail');
    const defEl = document.getElementById('vocab-definition');
    
    if (!detailEl || !defEl) return;
    
    defEl.innerHTML = renderDefinitions(currentVocabWord.definitions);
    detailEl.classList.remove('hidden');
}

// 评分单词
function rateVocabWord(quality) {
    if (!currentVocabWord) return;
    
    vocabProgress[currentVocabWord.word] = {
        quality,
        count: (vocabProgress[currentVocabWord.word]?.count || 0) + 1,
        lastReview: Date.now()
    };
    
    saveVocabProgress();
    updateVocabStats();
    
    // 显示下一个单词
    showNextVocabWord();
}

// 显示随机单词
function showRandomWord() {
    if (dictWords.length === 0) return;
    
    const randomWord = dictWords[Math.floor(Math.random() * dictWords.length)];
    document.getElementById('dict-search-input').value = randomWord.word;
    performSearch(randomWord.word);
}

// 隐藏所有面板
function hideAllPanels() {
    const panels = ['dict-welcome', 'dict-results', 'dict-history-panel', 'dict-favorites-panel', 'dict-vocab-panel'];
    panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

// 清空历史
function clearHistory() {
    searchHistory = [];
    saveHistory();
    renderHistoryPanel();
}

// 清空收藏
function clearFavorites() {
    if (favorites.length === 0) return;
    
    if (confirm('确定要清空所有收藏吗？')) {
        favorites = [];
        saveFavorites();
        updateFavoritesCount();
        renderFavoritesPanel();
    }
}

// 更新收藏数量
function updateFavoritesCount() {
    const countEl = document.getElementById('dict-favorites-count');
    if (countEl) {
        countEl.textContent = favorites.length;
    }
}

// 更新总词数
function updateTotalCount() {
    const countEl = document.getElementById('dict-total-count');
    if (countEl) {
        countEl.textContent = dictWords.length.toLocaleString();
    }
}
