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
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SECRET_KEY"
echo "   - COZE_BOT_ID (可选)"
echo "   - COZE_PAT_TOKEN (可选)"
echo "   - DEEPSEEK_API_KEY (可选)"
echo "   - TMDB_API_KEY (可选)"
echo ""

# 部署
echo "🚀 开始部署..."
railway up

echo "✅ 部署完成！"
echo "📝 查看日志: railway logs"
echo "🌐 打开网站: railway open"

