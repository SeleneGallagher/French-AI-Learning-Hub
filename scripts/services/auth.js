/**
 * 认证服务
 */
import { APIService } from './apiService.js';

export class AuthService {
    static getToken() {
        return APIService.getToken();
    }
    
    static setToken(token) {
        APIService.setToken(token);
    }
    
    static removeToken() {
        APIService.setToken(null);
    }
    
    static async login(username, password) {
        const response = await APIService.login(username, password);
        if (response.success) {
            this.setToken(response.token);
            return response.user;
        }
        throw new Error(response.message || '登录失败');
    }
    
    static async register(username, password, registrationCode) {
        const response = await APIService.register(username, password, registrationCode);
        if (response.success) {
            this.setToken(response.token);
            return response.user;
        }
        throw new Error(response.message || '注册失败');
    }
    
    static async verifyToken() {
        const token = this.getToken();
        if (!token) {
            throw new Error('未登录');
        }
        // 可以调用验证API，这里简化处理
        return true;
    }
    
    static isAuthenticated() {
        return !!this.getToken();
    }
}


