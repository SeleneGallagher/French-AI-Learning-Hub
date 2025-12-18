/**
 * 小三角确认对话框组件
 * 在按钮下方显示小型确认/取消按钮
 */

/**
 * 显示内联确认框（小三角样式）
 * @param {HTMLElement} targetButton - 触发按钮
 * @param {string} message - 确认消息
 * @returns {Promise<boolean>} 用户选择
 */
export function showConfirm(message, targetButton = null) {
    return new Promise((resolve) => {
        // 如果没有指定目标按钮，使用居中弹窗
        if (!targetButton) {
            const result = window.confirm(message.replace(/<[^>]*>/g, ''));
            resolve(result);
            return;
        }
        
        // 移除已存在的确认框
        const existingConfirm = document.querySelector('.inline-confirm-popup');
        if (existingConfirm) {
            existingConfirm.remove();
        }
        
        // 创建确认框
        const confirmBox = document.createElement('div');
        confirmBox.className = 'inline-confirm-popup';
        confirmBox.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 12px;
            z-index: 1000;
            min-width: 160px;
        `;
        
        confirmBox.innerHTML = `
            <div style="position: relative;">
                <div style="
                    position: absolute;
                    top: -20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 8px solid white;
                    filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.1));
                "></div>
                <p style="font-size: 12px; color: #374151; margin-bottom: 8px; text-align: center;">${message}</p>
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button class="confirm-ok" style="
                        padding: 4px 12px;
                        font-size: 12px;
                        background: #ef4444;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">确认</button>
                    <button class="confirm-cancel" style="
                        padding: 4px 12px;
                        font-size: 12px;
                        background: #e5e7eb;
                        color: #374151;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">取消</button>
                </div>
            </div>
        `;
        
        // 定位到按钮下方
        const rect = targetButton.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        confirmBox.style.top = (rect.bottom + scrollTop + 10) + 'px';
        confirmBox.style.left = (rect.left + scrollLeft + rect.width / 2 - 80) + 'px';
        
        document.body.appendChild(confirmBox);
        
        // 绑定事件
        const okBtn = confirmBox.querySelector('.confirm-ok');
        const cancelBtn = confirmBox.querySelector('.confirm-cancel');
        
        const cleanup = () => {
            confirmBox.remove();
            document.removeEventListener('click', outsideClickHandler);
        };
        
        okBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cleanup();
            resolve(true);
        });
        
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cleanup();
            resolve(false);
        });
        
        // 点击外部关闭
        const outsideClickHandler = (e) => {
            if (!confirmBox.contains(e.target) && e.target !== targetButton) {
                cleanup();
                resolve(false);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler);
        }, 100);
    });
}

/**
 * 为按钮添加确认功能
 * @param {HTMLElement} button - 按钮元素
 * @param {string} message - 确认消息
 * @param {Function} onConfirm - 确认回调
 */
export function addConfirmToButton(button, message, onConfirm) {
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const confirmed = await showConfirm(message, button);
        if (confirmed && onConfirm) {
            onConfirm();
        }
    });
}
