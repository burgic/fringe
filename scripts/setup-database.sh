#!/bin/bash

# Set up D1 database for Fringe Show Tracker

set -e

echo "🗄️ Setting up D1 database..."

# Create D1 database
echo "Creating D1 database..."
wrangler d1 create fringe-shows

echo ""
echo "📋 Copy the database_id from above and update these files:"
echo "   - apps/scheduler/wrangler.toml"
echo "   - apps/api/wrangler.toml"
echo ""
echo "Then run the following commands to set up the schema:"
echo ""
echo "# Apply schema to local database"
echo "wrangler d1 execute fringe-shows --local --file=database/schema.sql"
echo ""
echo "# Apply schema to production database"  
echo "wrangler d1 execute fringe-shows --file=database/schema.sql"
echo ""
echo "# Seed with initial data (optional)"
echo "wrangler d1 execute fringe-shows --file=database/seeds/initial_shows.sql"