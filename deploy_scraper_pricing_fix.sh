#!/bin/bash

echo "🔍 Deploying Enhanced Pricing Scraper..."

cd apps/scraper
wrangler deploy
cd ../..

echo "✅ Enhanced scraper deployed!"
echo ""
echo "🧪 Testing with longer waits and re-clicking..."
echo "This version:"
echo "  • Waits 6 seconds after each button click (up from 4)"
echo "  • Re-clicks buttons to trigger pricing API calls"
echo "  • Extended final wait of 5 seconds (up from 3)"
echo "  • Better logging of GraphQL response types"
echo ""
echo "To test: Add a new show or re-scrape an existing one"
