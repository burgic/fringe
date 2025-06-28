-- 006_simple_pricing_enhancement.sql
-- Add just the essential pricing fields we need

-- Add pricing details to performances table
ALTER TABLE performances ADD COLUMN price_details TEXT; -- JSON with full pricing breakdown
ALTER TABLE performances ADD COLUMN standard_price DECIMAL(10,2); -- Main ticket price
ALTER TABLE performances ADD COLUMN lowest_price DECIMAL(10,2); -- Cheapest option (including concessions)
ALTER TABLE performances ADD COLUMN availability_percentage INTEGER; -- How full the show is (0-100)
ALTER TABLE performances ADD COLUMN has_concessions BOOLEAN DEFAULT 0; -- Has student/senior discounts
ALTER TABLE performances ADD COLUMN has_free_accessibility BOOLEAN DEFAULT 0; -- Has free carer tickets

-- Add indexes for price-based queries
CREATE INDEX IF NOT EXISTS idx_performances_standard_price ON performances(standard_price);
CREATE INDEX IF NOT EXISTS idx_performances_lowest_price ON performances(lowest_price);
CREATE INDEX IF NOT EXISTS idx_performances_availability ON performances(availability_percentage);

-- Update shows table with computed pricing from performances
-- This will be updated via the API when performances are scraped
ALTER TABLE shows ADD COLUMN computed_price_range TEXT; -- Auto-calculated from performances
ALTER TABLE shows ADD COLUMN has_concession_pricing BOOLEAN DEFAULT 0;
ALTER TABLE shows ADD COLUMN has_free_accessibility BOOLEAN DEFAULT 0;
