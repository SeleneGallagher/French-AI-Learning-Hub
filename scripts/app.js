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
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1) || 'welcome';
        switchModule(hash);
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
                console.log('导航点击:', module); // 调试日志
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
    console.log('切换模块:', moduleName); // 调试日志
    
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
                console.error(`模块 ${moduleName} 初始化失败:`, error);
            }
        }
        
        // 滚动到顶部
        window.scrollTo(0, 0);
    } else {
        // 默认显示欢迎页
        console.warn(`模块 "${moduleName}" 不存在，切换到欢迎页`);
        if (moduleName !== 'welcome') {
            switchModule('welcome');
        }
    }
}

/**
 * 初始化模块
 * @param {string} moduleName - 模块名称
 */
async function initModule(moduleName) {
    try {
        switch (moduleName) {
            case 'welcome':
                // 欢迎页是静态的，不需要初始化
                break;
            case 'news':
                await initNews();
                break;
            case 'movies':
                await initMovies();
                break;
            case 'dictionary':
                await initDictionary();
                break;
            case 'expressions':
                await initExpressions();
                break;
            case 'ai-assistant':
                initAIAssistant();
                break;
            case 'login':
                initLogin();
                break;
            case 'about':
                initAbout();
                break;
            default:
                console.warn(`未知模块: ${moduleName}`);
        }
    } catch (error) {
        console.error(`初始化模块 ${moduleName} 失败:`, error);
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', init);
