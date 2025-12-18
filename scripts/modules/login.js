/**
 * 登录/注册模块
 */
import { AuthService } from '../services/auth.js';

let isLoginMode = true; // true=登录, false=注册

export function initLogin() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    
    if (!loginForm || !registerForm) return;
    
    // 切换登录/注册表单
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', () => {
            isLoginMode = false;
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        });
    }
    
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            isLoginMode = true;
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        });
    }
    
    // 登录
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    // 注册
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    
    // Enter键提交
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const registerUsername = document.getElementById('register-username');
    const registerPassword = document.getElementById('register-password');
    const registerCode = document.getElementById('register-code');
    
    [loginUsername, loginPassword].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin();
            });
        }
    });
    
    [registerUsername, registerPassword, registerCode].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleRegister();
            });
        }
    });
}

async function handleLogin() {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    
    if (!username || !password) {
        showError(errorEl, '请填写用户名和密码');
        return;
    }
    
    try {
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        
        await AuthService.login(username, password);
        
        // 登录成功，加载用户数据并跳转
        await loadUserData();
        window.location.hash = '#news';
    } catch (error) {
        showError(errorEl, error.message || '登录失败');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username')?.value.trim();
    const password = document.getElementById('register-password')?.value;
    const regCode = document.getElementById('register-code')?.value.trim();
    const errorEl = document.getElementById('register-error');
    const registerBtn = document.getElementById('register-btn');
    
    if (!username || !password || !regCode) {
        showError(errorEl, '请填写所有字段');
        return;
    }
    
    try {
        registerBtn.disabled = true;
        registerBtn.textContent = '注册中...';
        
        await AuthService.register(username, password, regCode);
        
        // 注册成功，加载用户数据并跳转
        await loadUserData();
        window.location.hash = '#news';
    } catch (error) {
        showError(errorEl, error.message || '注册失败');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
    }
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    } else {
        alert(message);
    }
}

async function loadUserData() {
    // 加载用户数据（后续实现）
    console.log('加载用户数据...');
}


