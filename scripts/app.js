/**
 * 主应用逻辑 - 路由和模块管理
 */

import { initNews } from './modules/news.js';
import { initMovies } from './modules/movies.js';
import { initDictionary } from './modules/dictionary.js';
import { initExpressions } from './modules/expressions.js';
import { initAIAssistant } from './modules/aiAssistant.js';
import { initLogin } from './modules/login.js';
import { initAbout } from './modules/about.js';
import { AuthService } from './services/auth.js';
import { Logger } from './utils/helpers.js';

// 当前激活的模块
let currentModule = null;
// 已初始化的模块集合（避免重复初始化）
const initializedModules = new Set();

/**
 * 初始化应用
 */
async function init() {
    // 初始化路由
    initRouter();

    // 初始化导航
    initNavigation();

    // 根据URL hash加载对应模块，默认显示欢迎页
    const hash = window.location.hash.slice(1);
    const moduleHash = hash || 'welcome';
    switchModule(moduleHash);
}

/**
 * 初始化路由
 */
function initRouter() {
    // 监听hash变化
    window.addEventListener('hashchange', async () => {
        const hash = window.location.hash.slice(1) || 'welcome';
        Logger.debug('Hash变化，切换到:', hash);
        try {
            await switchModule(hash);
        } catch (error) {
            Logger.error('切换模块失败:', error);
        }
    });
}

/**
 * 初始化导航
 */
function initNavigation() {
    // 导航链接点击事件
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const module = e.target.dataset.module || e.target.closest('a')?.dataset.module;
            if (module) {
                Logger.debug('导航点击:', module);
                window.location.hash = '#' + module;
            }
        });
    });
    
    // 顶部标题区域点击回到主页
    const header = document.querySelector('nav > div:first-child');
    if (header) {
        header.addEventListener('click', () => {
            window.location.hash = '#welcome';
        });
    }
    
    // 欢迎页中的链接也需要处理
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                const module = href.slice(1);
                if (module) {
                    e.preventDefault();
                    window.location.hash = '#' + module;
                }
            }
        });
    });
}

/**
 * 切换模块
 * @param {string} moduleName - 模块名称
 */
async function switchModule(moduleName) {
    Logger.debug('切换模块:', moduleName);
    
    // 隐藏所有模块
    document.querySelectorAll('.module').forEach(m => {
        m.classList.add('hidden');
    });

    // 移除所有导航激活状态
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // 显示目标模块
    const targetModule = document.getElementById(moduleName);
    
    if (targetModule) {
        targetModule.classList.remove('hidden');
        currentModule = moduleName;

        // 激活对应导航
        const navLink = document.querySelector(`[data-module="${moduleName}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }

        // 初始化模块（如果尚未初始化）
        if (!initializedModules.has(moduleName)) {
            try {
                await initModule(moduleName);
                initializedModules.add(moduleName);
            } catch (error) {
                Logger.error(`模块 ${moduleName} 初始化失败:`, error);
                // 显示用户友好的错误提示
                showModuleError(moduleName, error);
            }
        }
        
        // 滚动到顶部
        window.scrollTo(0, 0);
        
        // 更新移动端顶部标题栏
        updateMobileHeader(moduleName);
    } else {
        // 默认显示欢迎页
        Logger.warn(`模块 "${moduleName}" 不存在，切换到欢迎页`);
        if (moduleName !== 'welcome') {
            switchModule('welcome');
        }
    }
}

// 更新移动端顶部标题栏
function updateMobileHeader(moduleName) {
    const mobileHeader = document.getElementById('mobile-header');
    const mobileHeaderTitle = document.getElementById('mobile-header-title');
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    const mobileHomeBtn = document.getElementById('mobile-home-btn');
    
    if (!mobileHeader || !mobileHeaderTitle) return;
    
    const moduleTitles = {
        'welcome': { text: '首页', emoji: '', showBack: false, showHome: false },
        'news': { text: '实时新闻资讯', emoji: '📰', showBack: false, showHome: true },
        'movies': { text: '热门影视推荐', emoji: '🎬', showBack: false, showHome: true },
        'dictionary': { text: '法语词典', emoji: '📖', showBack: false, showHome: true },
        'expressions': { text: '语用积累', emoji: '💬', showBack: false, showHome: true },
        'ai-assistant': { text: 'AI助手', emoji: '🤖', showBack: false, showHome: true },
        'login': { text: '我的', emoji: '👤', showBack: false, showHome: true },
        'about': { text: '关于', emoji: 'ℹ️', showBack: true, showHome: false }
    };
    
    mobileHeader.classList.remove('hidden');
    const moduleInfo = moduleTitles[moduleName] || { text: moduleName, emoji: '', showBack: false, showHome: false };
    
    // 设置标题（居中显示）
    mobileHeaderTitle.innerHTML = moduleInfo.emoji ? `<span>${moduleInfo.emoji}</span><span>${moduleInfo.text}</span>` : `<span>${moduleInfo.text}</span>`;
    
    // 显示/隐藏返回按钮
    if (mobileBackBtn) {
        if (moduleInfo.showBack) {
            mobileBackBtn.classList.remove('hidden');
            mobileBackBtn.onclick = () => {
                window.location.hash = '#login';
            };
        } else {
            mobileBackBtn.classList.add('hidden');
        }
    }
    
    // 显示/隐藏首页按钮
    if (mobileHomeBtn) {
        if (moduleInfo.showHome) {
            mobileHomeBtn.classList.remove('hidden');
            mobileHomeBtn.onclick = () => {
                window.location.hash = '#welcome';
            };
        } else {
            mobileHomeBtn.classList.add('hidden');
        }
    }
}

/**
 * 显示模块错误提示
 * @param {string} moduleName - 模块名称
 * @param {Error} error - 错误对象
 */
function showModuleError(moduleName, error) {
    const targetModule = document.getElementById(moduleName);
    if (!targetModule) return;
    
    const errorEl = targetModule.querySelector('.module-error') || document.createElement('div');
    errorEl.className = 'module-error bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
    errorEl.textContent = `模块加载失败: ${error.message || '未知错误'}`;
    
    if (!targetModule.querySelector('.module-error')) {
        targetModule.insertBefore(errorEl, targetModule.firstChild);
    }
}

/**
 * 初始化模块
 * @param {string} moduleName - 模块名称
 */
async function initModule(moduleName) {
    Logger.debug('初始化模块:', moduleName);
    try {
        switch (moduleName) {
            case 'welcome':
                // 欢迎页是静态的，不需要初始化
                break;
            case 'news':
                Logger.debug('初始化新闻模块');
                await initNews();
                break;
            case 'movies':
                Logger.debug('初始化影视模块');
                await initMovies();
                break;
            case 'dictionary':
                Logger.debug('初始化词典模块');
                await initDictionary();
                break;
            case 'expressions':
                Logger.debug('初始化语用模块');
                await initExpressions();
                break;
            case 'ai-assistant':
                Logger.debug('初始化AI助手模块');
                initAIAssistant();
                break;
            case 'login':
                Logger.debug('初始化登录模块');
                initLogin();
                break;
            case 'about':
                Logger.debug('初始化关于模块');
                initAbout();
                break;
            default:
                Logger.warn(`未知模块: ${moduleName}`);
        }
    } catch (error) {
        Logger.error(`初始化模块 ${moduleName} 失败:`, error);
        throw error; // 重新抛出以便上层处理
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', init);
