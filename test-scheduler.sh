#!/bin/bash

echo "Testing Fringe Scheduler..."

echo "1. Deploying scheduler worker..."
cd /Users/christianburgin/Documents/projects/fringecloud/fringe-ticket-worker/apps/scheduler
npx wrangler deploy

echo "2. Triggering manual scraping..."
curl -X POST "https://fringe-scheduler.hraasing.workers.dev/trigger"

echo "3. Checking logs..."
npx wrangler tail --format=pretty
