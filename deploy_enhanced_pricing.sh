#!/bin/bash

echo "🚀 Deploying Enhanced Pricing Support..."

# Step 1: Apply database migration
echo "📊 Applying database migration..."
cd database
wrangler d1 execute fringe-shows --file=./migrations/006_simple_pricing_enhancement.sql
cd ..

# Step 2: Deploy scraper with enhanced pricing
echo "🔍 Deploying enhanced scraper..."
cd apps/scraper
wrangler deploy
cd ../..

# Step 3: Deploy scheduler with enhanced data storage
echo "⏰ Deploying enhanced scheduler..."
cd apps/scheduler
wrangler deploy
cd ../..

# Step 4: Deploy API (no changes needed but good to refresh)
echo "🔗 Deploying API..."
cd apps/api
wrangler deploy
cd ../..

echo "✅ Enhanced pricing support deployed successfully!"
echo ""
echo "🎯 What's new:"
echo "   • Scraper now captures detailed pricing from GraphQL API"
echo "   • Standard prices, concession prices, and accessibility tickets"
echo "   • Availability percentages (how full shows are)"
echo "   • Show-level price ranges automatically computed"
echo "   • Database stores all pricing details for analysis"
echo ""
echo "🧪 Testing:"
echo "   1. Add a show via admin interface"
echo "   2. Let it scrape - you should see pricing data in logs"
echo "   3. Check frontend - shows will display with enhanced pricing"
echo "   4. Look for concession pricing and accessibility options"
echo ""
echo "📊 Pricing data includes:"
echo "   • Standard ticket prices (£15)"
echo "   • Concession prices (£12 for students/seniors)"
echo "   • Free accessibility tickets (£0 for carers)" 
echo "   • Availability levels (75% remaining)"
echo "   • Price ranges (£12-£15)"
