#!/bin/bash

echo "🚀 Deploying Enhanced Venue & Accessibility Support"
echo "=================================================="

# Change to the project root
cd /Users/christianburgin/Documents/projects/fringecloud/fringe-ticket-worker

echo "1. Running database migration (005 - latest)..."
# Apply the latest migration that adds venue and accessibility tables
npx wrangler d1 execute fringe-shows --file=database/migrations/005_add_missing_columns_and_tables.sql

echo "2. Deploying scheduler worker..."
cd apps/scheduler
npx wrangler deploy

echo "3. Deploying API worker..."
cd ../api
npx wrangler deploy

echo "4. Deploying scraper worker..."
cd ../scraper
npx wrangler deploy

echo "5. Testing the system..."
echo "Checking shows in database..."
curl -s https://fringe-scheduler.hraasing.workers.dev/test | jq .

echo "\n6. Triggering a test scrape..."
curl -X POST https://fringe-scheduler.hraasing.workers.dev/trigger

echo "\n✅ Deployment complete!"
echo "\nNext steps:"
echo "- Check logs: npx wrangler tail fringe-scheduler --format=pretty"
echo "- View shows: curl https://fringe-api.hraasing.workers.dev/shows"
echo "- Add shows via admin panel or API"
echo "- Monitor scrape logs for venue/accessibility data"
