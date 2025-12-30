#!/bin/bash
# Railway 部署脚本

echo "🚀 开始部署到 Railway..."

# 检查是否安装了 Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI 未安装"
    echo "正在安装 Railway CLI..."
    npm install -g @railway/cli
fi

# 登录 Railway
echo "📝 请登录 Railway..."
railway login

# 初始化项目（如果还没有）
if [ ! -f "railway.json" ]; then
    echo "🔧 初始化 Railway 项目..."
    railway init
fi

# 设置环境变量提示
echo ""
echo "⚠️  请确保在 Railway Dashboard 中设置了以下环境变量："
echo "   - DATABASE_URL (必需，Railway 会自动设置 PostgreSQL)"
echo "   - JWT_SECRET (必需，用于用户认证)"
echo "   - COZE_BOT_ID (可选，AI助手功能)"
echo "   - COZE_PAT_TOKEN (可选，AI助手功能)"
echo "   - DEEPSEEK_API_KEY (可选，新闻关键词提取、语用生成)"
echo "   - TMDB_API_KEY (可选，电影数据)"
echo ""

# 部署
echo "🚀 开始部署..."
railway up

echo "✅ 部署完成！"
echo "📝 查看日志: railway logs"
echo "🌐 打开网站: railway open"

