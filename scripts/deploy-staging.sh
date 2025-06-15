#!/bin/bash

# Deploy script for Fringe Show Tracker
# Deploys all workers and sets up database

echo "🎭 Deploying Fringe Show Tracker..."

# Navigate to project root
cd /Users/christianburgin/Documents/projects/fringecloud/fringe-ticket-worker

echo "📁 Current directory: $(pwd)"

# Deploy in order of dependencies
echo ""
echo "🕷️  Deploying Scraper Worker..."
cd apps/scraper
npx wrangler deploy --env=staging
if [ $? -ne 0 ]; then
  echo "❌ Scraper deployment failed"
  exit 1
fi
echo "✅ Scraper deployed"

echo ""
echo "🗄️  Deploying API Worker..."
cd ../api
npx wrangler deploy --env=staging
if [ $? -ne 0 ]; then
  echo "❌ API deployment failed"
  exit 1
fi
echo "✅ API deployed"

echo ""
echo "⏰ Deploying Scheduler Worker..."
cd ../scheduler
npx wrangler deploy --env=staging
if [ $? -ne 0 ]; then
  echo "❌ Scheduler deployment failed"
  exit 1
fi
echo "✅ Scheduler deployed"

echo ""
echo "🌐 Deploying Frontend..."
cd ../frontend
npx wrangler pages deploy src --project-name=fringe-frontend-staging
if [ $? -ne 0 ]; then
  echo "❌ Frontend deployment failed"
  exit 1
fi
echo "✅ Frontend deployed"

echo ""
echo "🛠️  Deploying Admin Dashboard..."
cd ../admin
npx wrangler pages deploy src --project-name=fringe-admin-staging
if [ $? -ne 0 ]; then
  echo "❌ Admin deployment failed"
  exit 1
fi
echo "✅ Admin deployed"

# Go back to root
cd ../..

echo ""
echo "🗄️  Setting up database..."
npx wrangler d1 execute fringe-shows --file=database/schema_with_reviews.sql --env=staging
npx wrangler d1 execute fringe-shows --file=database/seeds/test_shows.sql --env=staging

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📋 Your URLs:"
echo "API: https://fringe-api-staging.your-subdomain.workers.dev"
echo "Scraper: https://fringe-scraper-staging.your-subdomain.workers.dev"
echo "Scheduler: https://fringe-scheduler-staging.your-subdomain.workers.dev"
echo "Frontend: https://fringe-frontend-staging.pages.dev"
echo "Admin: https://fringe-admin-staging.pages.dev"
echo ""
echo "🧪 Test the API:"
echo "curl 'https://fringe-api-staging.your-subdomain.workers.dev/shows'"
echo ""
echo "🔗 Test a lookup:"
echo "curl 'https://fringe-api-staging.your-subdomain.workers.dev/lookup?date=2025-08-15'"