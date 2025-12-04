-- Migration: Add quantity_made column to components table
-- Description: Track partial completion of components with a quantity_made field
-- Date: 2024-12-04

-- Add quantity_made column to components table
ALTER TABLE components ADD COLUMN quantity_made bigint NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN components.quantity_made IS 'Tracks how many units have been made/collected so far (for partial progress tracking)';

