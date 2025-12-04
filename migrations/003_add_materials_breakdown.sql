-- Add materials_breakdown column to components table
-- This stores the raw materials needed to build each component
-- Format: [{"typeId": number, "name": string, "quantity": number}, ...]

ALTER TABLE components 
ADD COLUMN IF NOT EXISTS materials_breakdown JSONB DEFAULT NULL;

-- Add build_cost column to store the calculated cost to build this component
ALTER TABLE components
ADD COLUMN IF NOT EXISTS build_cost NUMERIC DEFAULT NULL;

COMMENT ON COLUMN components.materials_breakdown IS 'JSON array of materials needed to build this component';
COMMENT ON COLUMN components.build_cost IS 'Total cost (materials + job cost) to build this component';

