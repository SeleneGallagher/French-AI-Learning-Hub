/**
 * 工具函数集合
 */

/**
 * 格式化日期
 * @param {string|Date} date - 日期对象或字符串
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 截取文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截取后的文本
 */
export function truncateText(text, maxLength = 150) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 解析XML文本
 * @param {string} xmlString - XML字符串
 * @returns {Document} XML文档对象
 */
export function parseXML(xmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * 显示错误消息
 * @param {HTMLElement} container - 容器元素
 * @param {string} message - 错误消息
 */
export function showError(container, message) {
    if (container) {
        container.textContent = message;
        container.classList.remove('hidden');
    }
}

/**
 * 隐藏加载状态
 * @param {HTMLElement} element - 加载元素
 */
export function hideLoading(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

/**
 * 显示加载状态
 * @param {HTMLElement} element - 加载元素
 */
export function showLoading(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 获取今天的日期字符串（YYYY-MM-DD）
 * @returns {string} 日期字符串
 */
export function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

/**
 * 比较日期（忽略时间）
 * @param {string|Date} date1 - 日期1
 * @param {string|Date} date2 - 日期2
 * @returns {number} 比较结果（-1, 0, 1）
 */
export function compareDates(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
}

