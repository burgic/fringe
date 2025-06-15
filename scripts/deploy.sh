#!/bin/bash

# Deploy all components of the Fringe Show Tracker

set -e  # Exit on any error

echo "🚀 Deploying Fringe Show Tracker..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install with: npm install -g wrangler"
    exit 1
fi

# Deploy in order (dependencies first)
echo ""
echo "📡 Deploying Scraper..."
cd apps/scraper && wrangler deploy
cd ../..

echo ""
echo "⏰ Deploying Scheduler..."
cd apps/scheduler && wrangler deploy
cd ../..

echo ""
echo "🚀 Deploying API..."
cd apps/api && wrangler deploy
cd ../..

echo ""
echo "🌐 Deploying Frontend..."
cd apps/frontend && wrangler pages deploy src
cd ../..

echo ""
echo "🛠️ Deploying Admin..."
cd apps/admin && wrangler pages deploy src
cd ../..

echo ""
echo "✅ All deployments complete!"
echo ""
echo "🔗 Your services should be available at:"
echo "   Scraper:   https://fringe-scraper.hraasing.workers.dev"
echo "   Scheduler: https://fringe-scheduler.hraasing.workers.dev"  
echo "   API:       https://fringe-api.hraasing.workers.dev"
echo "   Frontend:  https://fringe-frontend.pages.dev"
echo "   Admin:     https://fringe-admin.pages.dev"
echo ""
echo "📋 Next steps:"
echo "   1. Set up your D1 database: npm run setup-db"
echo "   2. Add some shows via the admin interface"
echo "   3. Trigger a manual scrape to test"