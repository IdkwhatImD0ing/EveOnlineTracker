-- migrations/015_character_scope_level.sql
-- Add scope_level column to track ESI permission level for each character

ALTER TABLE characters 
ADD COLUMN scope_level text DEFAULT 'minimal' CHECK (scope_level IN ('minimal', 'full'));

COMMENT ON COLUMN characters.scope_level IS 'ESI scope level: minimal (4 scopes) or full (60+ scopes)';

