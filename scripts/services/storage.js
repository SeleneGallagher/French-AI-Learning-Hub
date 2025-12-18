/**
 * 存储服务 - 封装 localStorage 和 IndexedDB
 */

const DB_NAME = 'FrenchLearningHub';
const DB_VERSION = 1;
const VOCAB_STORE = 'vocabulary';
const EXPRESSIONS_STORE = 'expressions';

let db = null;

/**
 * 初始化 IndexedDB
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
export function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error('无法打开数据库'));
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // 创建单词存储对象
            if (!database.objectStoreNames.contains(VOCAB_STORE)) {
                const vocabStore = database.createObjectStore(VOCAB_STORE, { keyPath: 'id', autoIncrement: true });
                vocabStore.createIndex('french', 'french', { unique: false });
                vocabStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false });
            }

            // 创建表达存储对象
            if (!database.objectStoreNames.contains(EXPRESSIONS_STORE)) {
                database.createObjectStore(EXPRESSIONS_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

/**
 * 保存单词到 IndexedDB
 * @param {Object} word - 单词对象
 * @returns {Promise<number>} 单词ID
 */
export async function saveWord(word) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([VOCAB_STORE], 'readwrite');
        const store = transaction.objectStore(VOCAB_STORE);

        // 检查是否已存在
        const index = store.index('french');
        const request = index.get(word.french);

        request.onsuccess = () => {
            if (request.result) {
                // 更新现有单词
                const existingWord = request.result;
                Object.assign(existingWord, word);
                const updateRequest = store.put(existingWord);
                updateRequest.onsuccess = () => resolve(existingWord.id);
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                // 添加新单词
                const addRequest = store.add(word);
                addRequest.onsuccess = () => resolve(addRequest.result);
                addRequest.onerror = () => reject(addRequest.error);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * 批量保存单词
 * @param {Array<Object>} words - 单词数组
 * @returns {Promise<void>}
 */
export async function saveWords(words) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([VOCAB_STORE], 'readwrite');
        const store = transaction.objectStore(VOCAB_STORE);
        let completed = 0;
        let hasError = false;

        words.forEach((word) => {
            const index = store.index('french');
            const checkRequest = index.get(word.french);

            checkRequest.onsuccess = () => {
                if (checkRequest.result) {
                    // 跳过已存在的单词
                    completed++;
                    if (completed === words.length && !hasError) {
                        resolve();
                    }
                } else {
                    const addRequest = store.add(word);
                    addRequest.onsuccess = () => {
                        completed++;
                        if (completed === words.length && !hasError) {
                            resolve();
                        }
                    };
                    addRequest.onerror = () => {
                        if (!hasError) {
                            hasError = true;
                            reject(addRequest.error);
                        }
                    };
                }
            };

            checkRequest.onerror = () => {
                if (!hasError) {
                    hasError = true;
                    reject(checkRequest.error);
                }
            };
        });
    });
}

/**
 * 获取需要复习的单词
 * @param {string} date - 日期字符串（YYYY-MM-DD）
 * @returns {Promise<Array<Object>>} 单词数组
 */
export async function getWordsForReview(date) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([VOCAB_STORE], 'readonly');
        const store = transaction.objectStore(VOCAB_STORE);
        const index = store.index('nextReviewDate');
        const request = index.getAll();

        request.onsuccess = () => {
            const allWords = request.result;
            const wordsForReview = allWords.filter(word => {
                const reviewDate = new Date(word.nextReviewDate);
                const targetDate = new Date(date);
                reviewDate.setHours(0, 0, 0, 0);
                targetDate.setHours(0, 0, 0, 0);
                return reviewDate <= targetDate;
            });
            resolve(wordsForReview);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取所有单词
 * @returns {Promise<Array<Object>>} 单词数组
 */
export async function getAllWords() {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([VOCAB_STORE], 'readonly');
        const store = transaction.objectStore(VOCAB_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 更新单词
 * @param {Object} word - 单词对象（必须包含id）
 * @returns {Promise<void>}
 */
export async function updateWord(word) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([VOCAB_STORE], 'readwrite');
        const store = transaction.objectStore(VOCAB_STORE);
        const request = store.put(word);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * 清除所有单词
 * @returns {Promise<void>}
 */
export async function clearAllWords() {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([VOCAB_STORE], 'readwrite');
        const store = transaction.objectStore(VOCAB_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * 保存表达
 * @param {Object} expression - 表达对象
 * @returns {Promise<number>} 表达ID
 */
export async function saveExpression(expression) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([EXPRESSIONS_STORE], 'readwrite');
        const store = transaction.objectStore(EXPRESSIONS_STORE);
        const request = store.add(expression);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取所有表达
 * @returns {Promise<Array<Object>>} 表达数组
 */
export async function getAllExpressions() {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([EXPRESSIONS_STORE], 'readonly');
        const store = transaction.objectStore(EXPRESSIONS_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 删除表达
 * @param {number} id - 表达ID
 * @returns {Promise<void>}
 */
export async function deleteExpression(id) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([EXPRESSIONS_STORE], 'readwrite');
        const store = transaction.objectStore(EXPRESSIONS_STORE);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * 更新表达
 * @param {Object} expression - 表达对象（必须包含id）
 * @returns {Promise<void>}
 */
export async function updateExpression(expression) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([EXPRESSIONS_STORE], 'readwrite');
        const store = transaction.objectStore(EXPRESSIONS_STORE);
        const request = store.put(expression);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * localStorage 封装
 */
export const localStorageService = {
    /**
     * 获取数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 数据
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('读取localStorage失败:', error);
            return defaultValue;
        }
    },

    /**
     * 保存数据
     * @param {string} key - 键名
     * @param {*} value - 值
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('保存localStorage失败:', error);
        }
    },

    /**
     * 删除数据
     * @param {string} key - 键名
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('删除localStorage失败:', error);
        }
    }
};

