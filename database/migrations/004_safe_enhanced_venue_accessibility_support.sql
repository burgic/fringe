-- 004_safe_enhanced_venue_accessibility_support.sql
-- Safe migration that checks for existing columns/tables

-- Create venues table (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fringe_venue_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    venue_code TEXT UNIQUE,
    address1 TEXT,
    address2 TEXT,
    post_code TEXT,
    geo_location TEXT,
    slug TEXT,
    images TEXT,
    attributes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create spaces table (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fringe_space_id INTEGER UNIQUE,
    venue_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    venue_name TEXT,
    venue_code TEXT,
    accessibility_notes TEXT,
    attributes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
);

-- Create ticket status options table (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS ticket_status_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    value TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    icon_name TEXT,
    description TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create performance history table (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS performance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    performance_id INTEGER NOT NULL,
    show_id INTEGER NOT NULL,
    date_time DATETIME NOT NULL,
    sold_out BOOLEAN DEFAULT 0,
    cancelled BOOLEAN DEFAULT 0,
    ticket_status TEXT,
    available BOOLEAN DEFAULT 0,
    scraped_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performance_id) REFERENCES performances(id) ON DELETE CASCADE,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
);

-- Create admin users table (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create system settings table (safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes (safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_shows_venue_id ON shows(venue_id);
CREATE INDEX IF NOT EXISTS idx_shows_venue_code ON shows(venue_code);

CREATE INDEX IF NOT EXISTS idx_performances_venue_id ON performances(venue_id);
CREATE INDEX IF NOT EXISTS idx_performances_space_id ON performances(space_id);
CREATE INDEX IF NOT EXISTS idx_performances_cancelled ON performances(cancelled);
CREATE INDEX IF NOT EXISTS idx_performances_tickets_available ON performances(tickets_available);

CREATE INDEX IF NOT EXISTS idx_venues_fringe_venue_id ON venues(fringe_venue_id);
CREATE INDEX IF NOT EXISTS idx_venues_venue_code ON venues(venue_code);
CREATE INDEX IF NOT EXISTS idx_venues_slug ON venues(slug);

CREATE INDEX IF NOT EXISTS idx_spaces_fringe_space_id ON spaces(fringe_space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_venue_id ON spaces(venue_id);
CREATE INDEX IF NOT EXISTS idx_spaces_venue_code ON spaces(venue_code);

CREATE INDEX IF NOT EXISTS idx_performance_history_show_id ON performance_history(show_id);
CREATE INDEX IF NOT EXISTS idx_performance_history_date ON performance_history(date_time);
CREATE INDEX IF NOT EXISTS idx_performance_history_scraped_at ON performance_history(scraped_at);

-- Create triggers (safe with IF NOT EXISTS)
CREATE TRIGGER IF NOT EXISTS update_venues_timestamp 
    AFTER UPDATE ON venues 
    FOR EACH ROW 
    BEGIN 
        UPDATE venues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

CREATE TRIGGER IF NOT EXISTS update_spaces_timestamp 
    AFTER UPDATE ON spaces 
    FOR EACH ROW 
    BEGIN 
        UPDATE spaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

CREATE TRIGGER IF NOT EXISTS update_system_settings_timestamp 
    AFTER UPDATE ON system_settings 
    FOR EACH ROW 
    BEGIN 
        UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
    END;

-- Insert default data (safe with INSERT OR IGNORE)
INSERT OR IGNORE INTO ticket_status_options (value, label, icon_name, description) VALUES
('TWO_FOR_ONE', '2 for 1', 'two_for_one', 'Special offer: buy one ticket, get one free'),
('TICKETS_AVAILABLE', 'Available', 'tickets_available', 'Tickets are available for purchase'),
('CANCELLED', 'Cancelled', 'cancelled', 'Performance has been cancelled'),
('EVENT_SPECIFIC', 'Event Specific', 'event_specific', 'Special event with specific ticketing requirements'),
('FREE_NON_TICKETED', 'Free (No Ticket)', 'free_non_ticketed', 'Free performance, no ticket required'),
('FREE_TICKETED', 'Free', 'free_ticketed', 'Free performance, but ticket required'),
('NO_ALLOCATION_CONTACT_VENUE', 'Contact Venue', 'no_allocation_contact_venue', 'No ticket allocation available, contact venue directly'),
('PREVIEW_SHOW', 'Preview', 'preview_show', 'Preview performance before official opening');

INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('scrape_interval_minutes', '60', 'How often to scrape show data (in minutes)'),
('max_scrape_retries', '3', 'Maximum number of retry attempts for failed scrapes'),
('scrape_timeout_seconds', '30', 'Timeout for individual scrape operations'),
('cleanup_old_performances_days', '7', 'How many days of old performance data to keep'),
('cleanup_old_logs_days', '30', 'How many days of old log data to keep'),
('api_rate_limit_per_minute', '100', 'API rate limit per minute per IP'),
('maintenance_mode', '0', 'Enable maintenance mode (1 = enabled, 0 = disabled)');
