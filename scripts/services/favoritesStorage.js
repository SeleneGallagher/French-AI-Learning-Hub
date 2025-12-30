/**
 * 收藏夹独立存储服务
 * 使用localStorage存储，不会被清除历史清除
 */

const FAVORITES_STORAGE_KEY = 'french_learning_favorites';

/**
 * 获取所有收藏
 * @returns {Array} 收藏数组
 */
export function getAllFavorites() {
    try {
        const favorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (favorites) {
            return JSON.parse(favorites);
        }
        return [];
    } catch (error) {
        console.error('读取收藏夹失败:', error);
        return [];
    }
}

/**
 * 保存所有收藏
 * @param {Array} favorites - 收藏数组
 */
export function saveAllFavorites(favorites) {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        // 如果已登录，同步到数据库
        uploadFavoritesToServer(favorites);
    } catch (error) {
        console.error('保存收藏夹失败:', error);
    }
}

// 上传收藏夹到服务器
async function uploadFavoritesToServer(favorites) {
    try {
        const token = APIService.getToken();
        if (!token) return;
        
        await APIService.uploadUserData({
            expression_favorites: favorites
        });
    } catch (e) {
        // 静默失败，不影响本地保存
        console.warn('上传收藏夹失败:', e);
    }
}

/**
 * 添加收藏
 * @param {Object} expression - 表达对象
 */
export function addFavorite(expression) {
    const favorites = getAllFavorites();
    
    // 检查是否已存在
    const exists = favorites.some(fav => fav.id === expression.id);
    if (exists) {
        return; // 已存在，不重复添加
    }
    
    // 添加收藏时间
    const favoriteItem = {
        ...expression,
        favoritedAt: new Date().toISOString()
    };
    
    favorites.push(favoriteItem);
    saveAllFavorites(favorites);
}

/**
 * 移除收藏
 * @param {number} id - 表达ID
 */
export function removeFavorite(id) {
    const favorites = getAllFavorites();
    const filtered = favorites.filter(fav => fav.id !== id);
    saveAllFavorites(filtered);
}

/**
 * 检查是否已收藏
 * @param {number} id - 表达ID
 * @returns {boolean} 是否已收藏
 */
export function isFavorite(id) {
    const favorites = getAllFavorites();
    return favorites.some(fav => fav.id === id);
}

/**
 * 切换收藏状态
 * @param {Object} expression - 表达对象
 * @returns {boolean} 新的收藏状态
 */
export function toggleFavorite(expression) {
    const isFav = isFavorite(expression.id);
    
    if (isFav) {
        removeFavorite(expression.id);
        return false;
    } else {
        addFavorite(expression);
        return true;
    }
}

