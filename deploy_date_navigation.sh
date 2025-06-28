#!/bin/bash

echo "📅 Deploying Enhanced Date Navigation..."

cd apps/frontend

# Deploy to Cloudflare Pages
npx wrangler pages deploy src --project-name fringe-frontend

cd ../..

echo "✅ Enhanced frontend deployed successfully!"
echo ""
echo "🎯 New Features:"
echo "   • ← → Arrow buttons for easy date navigation"
echo "   • Current date display (e.g., 'Mon 28 Jul')"
echo "   • Buttons automatically disable at festival start/end"
echo "   • Keyboard navigation with left/right arrow keys"
echo "   • Smooth transitions and hover effects"
echo ""
echo "🎪 Festival dates: 28 July - 25 August 2025"
echo ""
echo "💡 Usage:"
echo "   • Click ← → buttons to navigate dates"
echo "   • Use keyboard left/right arrows when not typing"
echo "   • Date picker still works for jumping to specific dates"
