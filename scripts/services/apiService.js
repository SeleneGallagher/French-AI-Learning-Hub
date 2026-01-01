/**
 * 统一API服务 - 调用Vercel Serverless Functions
 */
const API_BASE = '/api';

export class APIService {
    static getToken() {
        return localStorage.getItem('auth_token');
    }
    
    static setToken(token) {
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }
    
    static async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });
            
            // 检查响应类型
            const contentType = response.headers.get('content-type');
            
            if (response.status === 401) {
                // 检查是否是登录接口，如果是登录接口返回401，说明密码错误
                const isLoginEndpoint = endpoint.includes('/auth/login');
                if (isLoginEndpoint) {
                    // 尝试解析响应获取具体错误信息
                    try {
                        let errorData;
                        if (contentType && contentType.includes('application/json')) {
                            errorData = await response.json();
                        } else {
                            const text = await response.text();
                            try {
                                errorData = JSON.parse(text);
                            } catch {
                                errorData = { message: '密码错误，请重新输入' };
                            }
                        }
                        throw new Error(errorData.message || '密码错误，请重新输入');
                    } catch (e) {
                        // 如果已经是Error对象，直接抛出
                        if (e instanceof Error && e.message) {
                            throw e;
                        }
                        // 如果解析失败，使用默认消息
                        throw new Error('密码错误，请重新输入');
                    }
                } else {
                    // 其他接口的401错误，说明需要重新登录
                    this.setToken(null);
                    window.location.hash = '#login';
                    throw new Error('请重新登录');
                }
            }
            
            if (!contentType || !contentType.includes('application/json')) {
                // 如果不是JSON，尝试读取文本以获取错误信息
                const text = await response.text();
                throw new Error(`服务器返回非JSON响应 (${response.status}): ${text.substring(0, 100)}`);
            }
            
            const data = await response.json();
            if (!data.success && data.message) {
                throw new Error(data.message);
            }
            
            return data;
        } catch (error) {
            // 统一错误处理，避免重复日志
            if (error.message && !error.message.includes('请重新登录')) {
                console.error('API请求失败:', error.message);
            }
            throw error;
        }
    }
    
    // ========== 认证相关 ==========
    static async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }
    
    static async register(username, password, registrationCode) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ 
                username, 
                password, 
                registration_code: registrationCode 
            })
        });
    }
    
    // ========== 新闻相关 ==========
    static async getNews() {
        return this.request('/news/list');
    }
    
    // ========== 电影相关 ==========
    static async getMovies(refresh = false, category = '', type = '') {
        let url = '/movies/list';
        const params = [];
        if (refresh) params.push('refresh=true');
        if (category) params.push(`category=${category}`);
        if (type) params.push(`type=${type}`);
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        return this.request(url);
    }
    
    static async getCachedMovies(page = 1, limit = 25, category = 'all', type = 'mixed', minRating = 7.0) {
        const params = [];
        params.push(`page=${page}`);
        params.push(`limit=${limit}`);
        params.push(`category=${category}`);
        params.push(`type=${type}`);
        params.push(`min_rating=${minRating}`);
        return this.request(`/movies/cached?${params.join('&')}`);
    }
    
    static async uploadMoviesToCache(movies) {
        return this.request('/movies/cached', {
            method: 'POST',
            body: JSON.stringify({ movies })
        });
    }
    
    // ========== 词典相关 ==========
    static async getDictHistory(limit = 50) {
        return this.request(`/dictionary/history?limit=${limit}`);
    }
    
    static async addDictHistory(word) {
        return this.request('/dictionary/history', {
            method: 'POST',
            body: JSON.stringify({ word })
        });
    }
    
    static async getDictFavorites() {
        return this.request('/dictionary/favorites');
    }
    
    static async addDictFavorite(word, wordData) {
        return this.request('/dictionary/favorites', {
            method: 'POST',
            body: JSON.stringify({ word, word_data: wordData })
        });
    }
    
    static async removeDictFavorite(id) {
        return this.request(`/dictionary/favorites/${id}`, {
            method: 'DELETE'
        });
    }
    
    static async getVocabProgress() {
        return this.request('/dictionary/vocab-progress');
    }
    
    static async updateVocabProgress(word, quality, reviewCount) {
        return this.request('/dictionary/vocab-progress', {
            method: 'PUT',
            body: JSON.stringify({ word, quality, review_count: reviewCount })
        });
    }
    
    // ========== 语用相关 ==========
    static async getExpressions(limit = 50) {
        return this.request(`/expressions?limit=${limit}`);
    }
    
    static async createExpression(scenario, expressionData) {
        return this.request('/expressions', {
            method: 'POST',
            body: JSON.stringify({ scenario, expression_data: expressionData })
        });
    }
    
    static async getExpressionFavorites() {
        return this.request('/expressions/favorites');
    }
    
    static async favoriteExpression(expressionId) {
        return this.request(`/expressions/${expressionId}/favorite`, {
            method: 'POST'
        });
    }
    
    // ========== 用户数据同步 ==========
    static async syncUserData() {
        return this.request('/user/sync');
    }
    
    static async uploadUserData(data) {
        return this.request('/user/sync', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    // ========== AI助手相关 ==========
    static async getChatHistory(conversationId = null) {
        const url = conversationId 
            ? `/ai/chat-history?conversation_id=${conversationId}`
            : '/ai/chat-history';
        return this.request(url);
    }
    
    static async sendChatMessage(message, conversationId = null) {
        return this.request('/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ message, conversation_id: conversationId })
        });
    }
    
    static async clearChatHistory(conversationId = null) {
        return this.request('/ai/chat-history', {
            method: 'DELETE',
            body: JSON.stringify({ conversation_id: conversationId })
        });
    }
    
    // ========== 电影收藏相关 ==========
    static async getMovieFavorites() {
        return this.request('/movies/favorites');
    }
    
    static async addMovieFavorite(movieId, movieData) {
        return this.request('/movies/favorites', {
            method: 'POST',
            body: JSON.stringify({ movie_id: movieId, movie_data: movieData })
        });
    }
    
    static async removeMovieFavorite(movieId) {
        return this.request(`/movies/favorites/${movieId}`, {
            method: 'DELETE'
        });
    }
}


