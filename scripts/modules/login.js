/**
 * 登录/注册模块
 */
import { AuthService } from '../services/auth.js';

let isLoginMode = true; // true=登录, false=注册
let currentUser = null; // 当前登录用户

export function initLogin() {
    // 初始化移动端"我的"页面
    initMyPage();
    
    // 初始化桌面端登录/注册表单
    initAuthForms();
    
    // 更新用户状态显示
    updateUserStatus();
}

// 初始化移动端"我的"页面
function initMyPage() {
    // 移动端登录按钮
    const myLoginBtn = document.getElementById('my-login-btn');
    if (myLoginBtn) {
        myLoginBtn.addEventListener('click', () => {
            // 切换到登录表单（移动端显示桌面端表单）
            const loginForm = document.getElementById('login-form');
            const myPage = document.getElementById('my-page');
            if (loginForm && myPage) {
                myPage.classList.add('hidden');
                loginForm.closest('.hidden')?.classList.remove('hidden');
                loginForm.closest('div')?.classList.remove('hidden');
            }
        });
    }
    
    // 退出登录按钮
    const logoutBtn = document.getElementById('my-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 菜单项点击（后续完善）
    document.querySelectorAll('.my-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = href.slice(1);
                if (target === 'about') {
                    window.location.hash = '#about';
                } else {
                    // 其他功能后续完善
                    console.log('功能开发中:', target);
                }
            }
        });
    });
}

// 初始化桌面端登录/注册表单
function initAuthForms() {
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
        
        const user = await AuthService.register(username, password, regCode);
        currentUser = user;
        
        // 注册成功，加载用户数据并更新UI
        await loadUserData();
        updateUserStatus();
        
        // 移动端返回"我的"页面，桌面端跳转到新闻
        if (window.innerWidth < 768) {
            window.location.hash = '#login';
        } else {
            window.location.hash = '#news';
        }
    } catch (error) {
        showError(errorEl, error.message || '注册失败');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
    }
}

// 退出登录
async function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        AuthService.removeToken();
        currentUser = null;
        updateUserStatus();
        
        // 清空用户数据
        localStorage.removeItem('user_data');
        
        // 移动端刷新"我的"页面
        if (window.innerWidth < 768) {
            window.location.hash = '#login';
        }
    }
}

// 更新用户状态显示
function updateUserStatus() {
    const isAuthenticated = AuthService.isAuthenticated();
    const loggedInSection = document.getElementById('my-user-logged-in');
    const notLoggedInSection = document.getElementById('my-user-not-logged-in');
    const logoutSection = document.getElementById('my-logout-section');
    
    if (isAuthenticated && currentUser) {
        // 显示已登录状态
        if (loggedInSection) {
            loggedInSection.classList.remove('hidden');
            const usernameDisplay = document.getElementById('my-username-display');
            const userAccount = document.getElementById('my-user-account');
            const usernameAvatar = document.getElementById('my-username-avatar');
            
            if (usernameDisplay) {
                usernameDisplay.textContent = currentUser.username || '用户';
            }
            if (userAccount) {
                userAccount.textContent = `账号: ${currentUser.username || '未知'}`;
            }
            if (usernameAvatar) {
                usernameAvatar.textContent = (currentUser.username || 'U').charAt(0).toUpperCase();
            }
        }
        if (notLoggedInSection) {
            notLoggedInSection.classList.add('hidden');
        }
        if (logoutSection) {
            logoutSection.classList.remove('hidden');
        }
    } else {
        // 显示未登录状态
        if (loggedInSection) {
            loggedInSection.classList.add('hidden');
        }
        if (notLoggedInSection) {
            notLoggedInSection.classList.remove('hidden');
        }
        if (logoutSection) {
            logoutSection.classList.add('hidden');
        }
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
    // 这里可以调用API获取用户详细信息
    // const userData = await APIService.getUserProfile();
    // currentUser = { ...currentUser, ...userData };
}


