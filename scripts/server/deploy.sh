#!/bin/bash
# 快速部署脚本 - 在服务器上运行

echo "=========================================="
echo "  French AI Learning Hub - 部署脚本"
echo "=========================================="
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 root 用户运行此脚本"
    echo "使用: sudo $0"
    exit 1
fi

# 安装依赖
echo "[1/5] 安装系统依赖..."
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y python3 python3-pip nginx git
elif command -v yum &> /dev/null; then
    yum install -y python3 python3-pip nginx git
else
    echo "错误: 不支持的Linux发行版"
    exit 1
fi

# 安装 Python 依赖
echo "[2/5] 安装 Python 依赖..."
pip3 install -r scripts/server/requirements.txt

# 测试数据更新脚本
echo "[3/5] 测试数据更新脚本..."
cd "$(dirname "$0")/../.."
python3 scripts/server/update_data.py

if [ $? -ne 0 ]; then
    echo "警告: 数据更新脚本测试失败，请检查网络连接和API Key"
fi

# 配置 Nginx
echo "[4/5] 配置 Nginx..."
PROJECT_DIR=$(pwd)
NGINX_CONFIG="/etc/nginx/sites-available/french-ai"

cat > "$NGINX_CONFIG" <<EOF
server {
    listen 80;
    server_name _;
    
    root $PROJECT_DIR;
    index index.html;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|json)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# 启用配置
ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
systemctl enable nginx

# 配置定时任务
echo "[5/5] 配置定时任务..."
(crontab -l 2>/dev/null; echo "0 */6 * * * cd $PROJECT_DIR && /usr/bin/python3 scripts/server/update_data.py >> /var/log/french-ai-update.log 2>&1") | crontab -

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "网站地址: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "下一步："
echo "1. 配置域名（可选）"
echo "2. 申请SSL证书: certbot --nginx -d 你的域名.com"
echo "3. 检查数据更新: tail -f /var/log/french-ai-update.log"
echo ""

