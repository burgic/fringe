-- Migration to add rich performance data fields
-- Run this after the existing schema

-- Add new columns to performances table
ALTER TABLE performances ADD COLUMN title TEXT;
ALTER TABLE performances ADD COLUMN duration INTEGER;
ALTER TABLE performances ADD COLUMN status TEXT;
ALTER TABLE performances ADD COLUMN cancelled BOOLEAN DEFAULT FALSE;
ALTER TABLE performances ADD COLUMN tickets_available BOOLEAN;
ALTER TABLE performances ADD COLUMN box_office_id TEXT;

-- Event metadata
ALTER TABLE performances ADD COLUMN event_title TEXT;
ALTER TABLE performances ADD COLUMN event_genre TEXT;
ALTER TABLE performances ADD COLUMN event_sub_genre TEXT;
ALTER TABLE performances ADD COLUMN price_type TEXT; -- JSON string of array
ALTER TABLE performances ADD COLUMN free_ticketed BOOLEAN DEFAULT FALSE;
ALTER TABLE performances ADD COLUMN presented_by TEXT;

-- Venue information
ALTER TABLE performances ADD COLUMN venue_name TEXT;
ALTER TABLE performances ADD COLUMN venue_address TEXT;
ALTER TABLE performances ADD COLUMN space_name TEXT;
ALTER TABLE performances ADD COLUMN accessibility TEXT; -- JSON string of array

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_performances_free ON performances(free_ticketed);
CREATE INDEX IF NOT EXISTS idx_performances_cancelled ON performances(cancelled);
CREATE INDEX IF NOT EXISTS idx_performances_genre ON performances(event_genre);
