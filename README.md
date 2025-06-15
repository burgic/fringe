# Edinburgh Fringe Show Tracker

A complete system for tracking Edinburgh Fringe show availability using Cloudflare Workers and D1 database.

## 🏗️ Architecture

- **Scraper**: Individual show data extraction using Puppeteer
- **Scheduler**: Hourly automated scraping of all shows
- **API**: Fast lookup service with filtering
- **Frontend**: User-facing website for date-based show search
- **Admin**: Management dashboard for shows and monitoring

## 🚀 Quick Start

### 1. Setup Database
```bash
# Create D1 database
npm run setup-db

# Copy the database_id and update wrangler.toml files
# Then apply schema:
wrangler d1 execute fringe-shows --file=database/schema.sql
```

### 2. Deploy All Services
```bash
npm run deploy:all
```

### 3. Test Scraper
```bash
npm run test:scraper
```

## 📁 Project Structure

```
apps/
├── scraper/     # Individual show scraper (Puppeteer)
├── scheduler/   # Hourly scraping orchestrator  
├── api/         # Fast lookup API
├── frontend/    # User website
└── admin/       # Management dashboard

database/
├── schema.sql   # Database tables
└── seeds/       # Sample data
```

## 🛠️ Development

### Start Individual Services
```bash
npm run dev:scraper    # Test scraper locally
npm run dev:api        # API development  
npm run dev:frontend   # Website development
npm run dev:admin      # Admin development
```

### Deploy Individual Services
```bash
npm run deploy:scraper
npm run deploy:scheduler  
npm run deploy:api
npm run deploy:frontend
npm run deploy:admin
```

### Monitor Logs
```bash
npm run logs:scraper
npm run logs:scheduler
npm run logs:api
```

## 📊 API Endpoints

### Public API
- `GET /lookup?date=2025-08-01&genre=comedy` - Find shows by date/filters
- `GET /shows` - List all active shows
- `GET /stats` - System statistics

### Admin API  
- `POST /shows` - Add new show to monitor
- `DELETE /shows/:id` - Remove show from monitoring

### Scheduler
- `POST /trigger` - Manual scrape trigger
- `GET /status` - Recent scrape logs

## 🗄️ Database Schema

- **shows** - Master list of shows to monitor
- **performances** - Current availability data
- **scrape_logs** - Scraping history and errors

## ⏰ Automation

The scheduler runs every hour (`0 * * * *`) to:
1. Get all active shows from database
2. Scrape each show using the scraper worker
3. Update performance data in database
4. Log results and errors

## 🎯 Features

- **Real-time availability** - Hourly updates
- **Fast lookups** - Cached data for instant results
- **Flexible filtering** - By date, genre, venue
- **Admin dashboard** - Easy show management
- **Error monitoring** - Detailed scrape logs
- **Rate limiting** - Respectful scraping intervals

## 🔧 Configuration

Update these URLs in the configuration files:
- `SCRAPER_URL` in scheduler/wrangler.toml
- `API_BASE_URL` in frontend/src/app.js
- `API_BASE_URL` in admin/src/admin.js

## 📈 Monitoring

- View scrape success/failure rates in admin dashboard
- Monitor logs with `npm run logs:*` commands
- Check system stats at `/stats` endpoint
- Set up webhooks for notifications (optional)

## 🚀 Production Checklist

- [ ] Update all URL references to your deployed workers
- [ ] Set up D1 database with proper database_id
- [ ] Deploy all services
- [ ] Add initial shows via admin dashboard
- [ ] Test manual scrape trigger
- [ ] Verify hourly automation is working
- [ ] Set up monitoring/alerting (optional)

## 🛡️ Security

- Admin dashboard has no authentication (add if needed)
- API endpoints are public (add auth if needed)
- Rate limiting built into scraper
- Respectful 3-second delays between requests# fringe
