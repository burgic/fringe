#!/bin/bash

echo "🧪 Testing Enhanced Pricing Scraper..."

# Test URL - replace with an actual Edinburgh Fringe show URL
TEST_URL="https://www.edfringe.com/tickets/whats-on/example-show"

echo "📝 Testing scraper with URL: $TEST_URL"
echo ""

# Call the scraper directly
curl -X GET "https://fringe-scraper.hraasing.workers.dev?url=$TEST_URL" \
  -H "Accept: application/json" \
  | jq '.stats.pricing // "No pricing data found"'

echo ""
echo "🔍 What to look for in the response:"
echo "   • stats.pricing.range (e.g., '£12-£15')"
echo "   • stats.pricing.hasConcessions: true"
echo "   • stats.pricing.hasFreeAccessibility: true"
echo "   • performances[].standardPrice: 15.0"
echo "   • performances[].lowestPrice: 12.0"
echo "   • performances[].priceDetails: full JSON pricing data"
echo ""
echo "✅ If you see pricing data, the enhancement is working!"
