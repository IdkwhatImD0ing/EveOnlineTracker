-- migrations/010_users_and_characters.sql
-- Multi-account support with alt characters

-- Users table (one per person)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_character_id bigint NOT NULL,
  main_character_name text NOT NULL,
  allowed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Characters table (multiple per user)
CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id bigint NOT NULL UNIQUE,
  character_name text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expires_at timestamptz,
  is_main boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_character_id ON characters(character_id);
CREATE INDEX idx_users_main_character_id ON users(main_character_id);

-- Trigger to update updated_at on users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on characters table
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Application users, identified by their main EVE character';
COMMENT ON TABLE characters IS 'EVE characters linked to users, stores OAuth tokens';
COMMENT ON COLUMN users.allowed IS 'Whether the user is allowed to access the application';
COMMENT ON COLUMN characters.is_main IS 'Whether this is the users main character';

