#!/bin/bash

# Test script for Fringe Show Tracker
# Sets up database and tests core components

echo "🎭 Setting up Fringe Show Tracker for testing..."

# Navigate to project root
cd /Users/christianburgin/Documents/projects/fringecloud/fringe-ticket-worker

echo "📁 Current directory: $(pwd)"

# Check if we have the database
echo "🗄️  Setting up database..."

# Apply schema (with reviews)
echo "Creating database schema..."
npx wrangler d1 execute fringe-shows --file=database/schema_with_reviews.sql --env=staging

# Seed with test data
echo "Adding test shows..."
npx wrangler d1 execute fringe-shows --file=database/seeds/test_shows.sql --env=staging

echo "✅ Database setup complete!"

# Test the scraper worker
echo "🕷️  Testing scraper with David O'Doherty show..."
echo "This will test the core scraping functionality..."

# Note: You'll need to deploy the scraper first or test locally
echo "To test scraper, run:"
echo "cd apps/scraper && npx wrangler dev"
echo "Then in another terminal:"
echo "curl 'http://localhost:8787/?url=https://www.edfringe.com/tickets/whats-on/david-o-doherty-highway-to-the-david-zone'"

echo ""
echo "🚀 Next steps:"
echo "1. Deploy scraper: cd apps/scraper && npx wrangler deploy"
echo "2. Deploy API: cd apps/api && npx wrangler deploy" 
echo "3. Deploy scheduler: cd apps/scheduler && npx wrangler deploy"
echo "4. Test end-to-end with: curl 'https://your-api-url/lookup?date=2025-08-15'"
