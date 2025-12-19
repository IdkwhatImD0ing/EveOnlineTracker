-- migrations/011_user_roles.sql
-- Add role-based access control to users table
-- Roles: public, slyce, user, pro, admin

-- Create enum type for user roles
CREATE TYPE user_role AS ENUM ('public', 'slyce', 'user', 'pro', 'admin');

-- Add role column with default 'public'
ALTER TABLE users
ADD COLUMN role user_role DEFAULT 'public';

-- Migrate existing users based on 'allowed' status
-- allowed = true -> 'user' (they were manually approved)
-- allowed = false -> 'public' (pending approval)
UPDATE users SET role = 'user' WHERE allowed = true;
UPDATE users SET role = 'public' WHERE allowed = false;

-- Make role NOT NULL after migration
ALTER TABLE users
ALTER COLUMN role SET NOT NULL;

-- Drop the allowed column (no longer needed)
ALTER TABLE users
DROP COLUMN allowed;

-- Add index for role lookups
CREATE INDEX idx_users_role ON users(role);

-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role: public (pending), slyce (alliance member), user (approved), pro (premium), admin (full access)';

