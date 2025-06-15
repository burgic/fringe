#!/bin/bash

# Setup script for Fringe Show Tracker database
echo "🗄️  Setting up D1 database for Fringe Show Tracker..."

cd /Users/christianburgin/Documents/projects/fringecloud/fringe-ticket-worker

# Create the D1 database
echo "Creating D1 database..."
npx wrangler d1 create fringe-shows

echo ""
echo "📋 Next steps:"
echo "1. Copy the database_id from above output"
echo "2. Update the wrangler.toml files in apps/api and apps/scheduler with this database_id"
echo "3. Run the setup script again to apply schema"
echo ""
echo "Example wrangler.toml section:"
echo '[[d1_databases]]'
echo 'binding = "DB"'
echo 'database_name = "fringe-shows"'
echo 'database_id = "YOUR_DATABASE_ID_FROM_ABOVE"'
