-- Edinburgh Fringe Show Tracker Database Schema
-- Run this to set up your D1 database

-- Shows table - master list of shows to monitor
CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, -- extracted from URL for easy reference
  venue TEXT,
  description TEXT,
  genre TEXT,
  duration_minutes INTEGER,
  price_range TEXT, -- e.g., "£8-12"
  rating TEXT, -- e.g., "15+", "U"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE -- to disable monitoring
);

-- Performances table - current availability data
CREATE TABLE IF NOT EXISTS performances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  performance_id INTEGER NOT NULL, -- from Edinburgh Fringe API
  date_time DATETIME NOT NULL,
  sold_out BOOLEAN NOT NULL,
  ticket_status TEXT NOT NULL, -- 'TICKETS_AVAILABLE', 'PREVIEW_SHOW', etc.
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows (id),
  UNIQUE(show_id, performance_id) -- prevent duplicates
);

-- Scrape logs table - track scraping history and errors
CREATE TABLE IF NOT EXISTS scrape_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'success', 'error', 'timeout'
  performances_found INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows (id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_performances_show_date ON performances(show_id, date_time);
CREATE INDEX IF NOT EXISTS idx_performances_date ON performances(date_time);
CREATE INDEX IF NOT EXISTS idx_performances_status ON performances(ticket_status, sold_out);
CREATE INDEX IF NOT EXISTS idx_shows_active ON shows(is_active);
CREATE INDEX IF NOT EXISTS idx_shows_genre ON shows(genre);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_show_date ON scrape_logs(show_id, scraped_at);