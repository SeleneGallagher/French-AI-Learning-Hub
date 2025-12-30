/**
 * 管理员模块
 */
let adminPassword = '';

export function initAdmin() {
    // 管理员入口按钮
    const adminAccessBtn = document.getElementById('admin-access-btn');
    if (adminAccessBtn) {
        adminAccessBtn.addEventListener('click', () => {
            window.location.hash = '#admin';
        });
    }
    
    // 管理员登录
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminLoginError = document.getElementById('admin-login-error');
    
    if (adminLoginBtn && adminPasswordInput) {
        adminLoginBtn.addEventListener('click', handleAdminLogin);
        adminPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAdminLogin();
            }
        });
    }
    
    // 刷新按钮
    const adminRefreshBtn = document.getElementById('admin-refresh-btn');
    if (adminRefreshBtn) {
        adminRefreshBtn.addEventListener('click', loadUsers);
    }
    
    // 标签页切换
    const adminTabUsers = document.getElementById('admin-tab-users');
    const adminTabCodes = document.getElementById('admin-tab-codes');
    const adminUsersTab = document.getElementById('admin-users-tab');
    const adminCodesTab = document.getElementById('admin-codes-tab');
    
    if (adminTabUsers && adminTabCodes) {
        adminTabUsers.addEventListener('click', () => switchTab('users'));
        adminTabCodes.addEventListener('click', () => switchTab('codes'));
    }
    
    // 注册码管理
    const adminAddCodeBtn = document.getElementById('admin-add-code-btn');
    const adminAddCodeForm = document.getElementById('admin-add-code-form');
    const adminSaveCodeBtn = document.getElementById('admin-save-code-btn');
    const adminCancelCodeBtn = document.getElementById('admin-cancel-code-btn');
    const adminRefreshCodesBtn = document.getElementById('admin-refresh-codes-btn');
    
    if (adminAddCodeBtn && adminAddCodeForm) {
        adminAddCodeBtn.addEventListener('click', () => {
            adminAddCodeForm.classList.remove('hidden');
        });
    }
    
    if (adminCancelCodeBtn && adminAddCodeForm) {
        adminCancelCodeBtn.addEventListener('click', () => {
            adminAddCodeForm.classList.add('hidden');
            document.getElementById('new-code-input').value = '';
            document.getElementById('new-code-unlimited').checked = false;
            document.getElementById('new-code-active').checked = true;
            const errorEl = document.getElementById('admin-code-error');
            if (errorEl) errorEl.classList.add('hidden');
        });
    }
    
    if (adminSaveCodeBtn) {
        adminSaveCodeBtn.addEventListener('click', handleCreateCode);
    }
    
    if (adminRefreshCodesBtn) {
        adminRefreshCodesBtn.addEventListener('click', loadCodes);
    }
}

function switchTab(tab) {
    const adminTabUsers = document.getElementById('admin-tab-users');
    const adminTabCodes = document.getElementById('admin-tab-codes');
    const adminUsersTab = document.getElementById('admin-users-tab');
    const adminCodesTab = document.getElementById('admin-codes-tab');
    
    if (tab === 'users') {
        if (adminTabUsers) {
            adminTabUsers.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            adminTabUsers.classList.remove('text-gray-600');
        }
        if (adminTabCodes) {
            adminTabCodes.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            adminTabCodes.classList.add('text-gray-600');
        }
        if (adminUsersTab) adminUsersTab.classList.remove('hidden');
        if (adminCodesTab) adminCodesTab.classList.add('hidden');
    } else {
        if (adminTabCodes) {
            adminTabCodes.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            adminTabCodes.classList.remove('text-gray-600');
        }
        if (adminTabUsers) {
            adminTabUsers.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            adminTabUsers.classList.add('text-gray-600');
        }
        if (adminCodesTab) adminCodesTab.classList.remove('hidden');
        if (adminUsersTab) adminUsersTab.classList.add('hidden');
        loadCodes();
    }
}

async function handleAdminLogin() {
    const adminPasswordInput = document.getElementById('admin-password');
    const adminLoginError = document.getElementById('admin-login-error');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    
    if (!adminPasswordInput || !adminLoginError || !adminLoginBtn) return;
    
    const password = adminPasswordInput.value.trim();
    
    if (!password) {
        showAdminError(adminLoginError, '请输入管理员密码');
        return;
    }
    
    try {
        adminLoginBtn.disabled = true;
        adminLoginBtn.textContent = '登录中...';
        adminLoginError.classList.add('hidden');
        
        // 保存管理员密码（用于后续API调用）
        adminPassword = password;
        
        // 尝试加载用户列表来验证密码
        await loadUsers();
        
        // 登录成功，显示用户列表
        const adminLoginSection = document.getElementById('admin-login-section');
        const adminUsersSection = document.getElementById('admin-users-section');
        
        if (adminLoginSection) {
            adminLoginSection.classList.add('hidden');
        }
        if (adminUsersSection) {
            adminUsersSection.classList.remove('hidden');
        }
        
        // 默认显示用户标签页
        switchTab('users');
        
    } catch (error) {
        showAdminError(adminLoginError, error.message || '登录失败');
        adminPassword = '';
    } finally {
        adminLoginBtn.disabled = false;
        adminLoginBtn.textContent = '登录';
    }
}

async function loadUsers() {
    const adminUsersList = document.getElementById('admin-users-list');
    const adminUsersLoading = document.getElementById('admin-users-loading');
    const adminUsersCount = document.getElementById('admin-users-count');
    const adminLoginError = document.getElementById('admin-login-error');
    
    if (!adminUsersList || !adminUsersLoading) return;
    
    if (!adminPassword) {
        if (adminLoginError) {
            showAdminError(adminLoginError, '请先登录');
        }
        return;
    }
    
    try {
        adminUsersLoading.classList.remove('hidden');
        adminUsersList.innerHTML = '';
        
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
                'X-Admin-Password': adminPassword
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '获取用户列表失败');
        }
        
        // 更新用户数量
        if (adminUsersCount) {
            adminUsersCount.textContent = `共 ${data.count} 个用户`;
        }
        
        // 显示用户列表
        if (data.users && data.users.length > 0) {
            const usersHtml = data.users.map((user, index) => {
                const createdDate = user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '未知';
                const lastLoginDate = user.last_login ? new Date(user.last_login).toLocaleString('zh-CN') : '从未登录';
                const statusBadge = user.is_active 
                    ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">活跃</span>'
                    : '<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">已禁用</span>';
                
                return `
                    <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="text-sm text-gray-500">#${index + 1}</span>
                                    <span class="font-semibold text-gray-800">${escapeHtml(user.username)}</span>
                                    ${statusBadge}
                                </div>
                                <div class="text-xs text-gray-500 space-y-1">
                                    <div>用户ID: <code class="bg-gray-100 px-1 rounded">${user.id}</code></div>
                                    <div>注册时间: ${createdDate}</div>
                                    <div>最后登录: ${lastLoginDate}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            adminUsersList.innerHTML = usersHtml;
        } else {
            adminUsersList.innerHTML = '<div class="text-center py-8 text-gray-500">暂无用户</div>';
        }
        
    } catch (error) {
        if (adminLoginError) {
            showAdminError(adminLoginError, error.message || '加载用户列表失败');
        }
        adminUsersList.innerHTML = '<div class="text-center py-8 text-red-500">加载失败</div>';
    } finally {
        adminUsersLoading.classList.add('hidden');
    }
}

function showAdminError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadCodes() {
    const adminCodesList = document.getElementById('admin-codes-list');
    const adminCodesLoading = document.getElementById('admin-codes-loading');
    const adminCodesCount = document.getElementById('admin-codes-count');
    const adminCodeError = document.getElementById('admin-code-error');
    
    if (!adminCodesList || !adminCodesLoading) return;
    
    if (!adminPassword) {
        if (adminCodeError) {
            showAdminError(adminCodeError, '请先登录');
        }
        return;
    }
    
    try {
        adminCodesLoading.classList.remove('hidden');
        adminCodesList.innerHTML = '';
        
        const response = await fetch('/api/admin/registration-codes', {
            method: 'GET',
            headers: {
                'X-Admin-Password': adminPassword
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '获取注册码列表失败');
        }
        
        // 更新注册码数量
        if (adminCodesCount) {
            adminCodesCount.textContent = `共 ${data.count || 0} 个注册码`;
        }
        
        // 显示注册码列表
        if (data.codes && data.codes.length > 0) {
            const codesHtml = data.codes.map((code, index) => {
                const statusBadge = code.is_active 
                    ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">激活</span>'
                    : '<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">已禁用</span>';
                const unlimitedBadge = code.unlimited_use 
                    ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">永久</span>'
                    : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">单次</span>';
                const usedInfo = code.used_at 
                    ? `<div class="text-xs text-gray-500">使用时间: ${new Date(code.used_at).toLocaleString('zh-CN')}</div>`
                    : '<div class="text-xs text-gray-500">未使用</div>';
                
                return `
                    <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="text-sm text-gray-500">#${index + 1}</span>
                                    <code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">${escapeHtml(code.code)}</code>
                                    ${statusBadge}
                                    ${unlimitedBadge}
                                </div>
                                ${usedInfo}
                            </div>
                            <button class="delete-code-btn px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm" data-code-id="${code.id}">
                                删除
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            adminCodesList.innerHTML = codesHtml;
            
            // 绑定删除按钮
            document.querySelectorAll('.delete-code-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const codeId = btn.dataset.codeId;
                    if (confirm('确定删除此注册码？')) {
                        try {
                            const response = await fetch(`/api/admin/registration-codes`, {
                                method: 'DELETE',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Admin-Password': adminPassword
                                },
                                body: JSON.stringify({ id: codeId })
                            });
                            
                            const data = await response.json();
                            if (data.success) {
                                loadCodes(); // 重新加载列表
                            } else {
                                alert('删除失败: ' + (data.message || '未知错误'));
                            }
                        } catch (error) {
                            alert('删除失败: ' + error.message);
                        }
                    }
                });
            });
        } else {
            adminCodesList.innerHTML = '<div class="text-center py-8 text-gray-500">暂无注册码</div>';
        }
        
    } catch (error) {
        if (adminCodeError) {
            showAdminError(adminCodeError, error.message || '加载注册码列表失败');
        }
        adminCodesList.innerHTML = '<div class="text-center py-8 text-red-500">加载失败</div>';
    } finally {
        adminCodesLoading.classList.add('hidden');
    }
}

async function handleCreateCode() {
    const newCodeInput = document.getElementById('new-code-input');
    const newCodeUnlimited = document.getElementById('new-code-unlimited');
    const newCodeActive = document.getElementById('new-code-active');
    const adminCodeError = document.getElementById('admin-code-error');
    const adminSaveCodeBtn = document.getElementById('admin-save-code-btn');
    
    if (!newCodeInput || !adminCodeError || !adminSaveCodeBtn) return;
    
    const code = newCodeInput.value.trim();
    const unlimited = newCodeUnlimited ? newCodeUnlimited.checked : false;
    const isActive = newCodeActive ? newCodeActive.checked : true;
    
    if (!code) {
        showAdminError(adminCodeError, '请输入注册码');
        return;
    }
    
    if (!adminPassword) {
        showAdminError(adminCodeError, '请先登录');
        return;
    }
    
    try {
        adminSaveCodeBtn.disabled = true;
        adminSaveCodeBtn.textContent = '保存中...';
        adminCodeError.classList.add('hidden');
        
        const response = await fetch('/api/admin/registration-codes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': adminPassword
            },
            body: JSON.stringify({
                code: code,
                unlimited_use: unlimited,
                is_active: isActive
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 清空表单
            newCodeInput.value = '';
            if (newCodeUnlimited) newCodeUnlimited.checked = false;
            if (newCodeActive) newCodeActive.checked = true;
            
            // 隐藏表单
            const adminAddCodeForm = document.getElementById('admin-add-code-form');
            if (adminAddCodeForm) {
                adminAddCodeForm.classList.add('hidden');
            }
            
            // 重新加载列表
            loadCodes();
        } else {
            showAdminError(adminCodeError, data.message || '创建失败');
        }
    } catch (error) {
        showAdminError(adminCodeError, error.message || '创建失败');
    } finally {
        adminSaveCodeBtn.disabled = false;
        adminSaveCodeBtn.textContent = '保存';
    }
}

