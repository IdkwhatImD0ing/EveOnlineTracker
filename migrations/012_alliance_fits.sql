 -- migrations/012_alliance_fits.sql
-- Alliance Fits table for storing parsed ship fittings

CREATE TABLE alliance_fits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_type_id bigint NOT NULL,
  ship_name text NOT NULL,
  fit_name text NOT NULL,
  raw_eft text NOT NULL,
  items jsonb NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups by ship
CREATE INDEX idx_alliance_fits_ship_type_id ON alliance_fits(ship_type_id);

-- Index for faster lookups by creator
CREATE INDEX idx_alliance_fits_created_by ON alliance_fits(created_by);

-- Trigger for updated_at
CREATE TRIGGER update_alliance_fits_updated_at
  BEFORE UPDATE ON alliance_fits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE alliance_fits IS 'Alliance ship fittings parsed from EFT format';
COMMENT ON COLUMN alliance_fits.raw_eft IS 'Original EFT-formatted fit text';
COMMENT ON COLUMN alliance_fits.items IS 'Parsed items array: [{type_id, name, quantity, slot}]';

