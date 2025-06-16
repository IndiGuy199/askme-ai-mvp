-- Add session tracking column to user_profiles table
-- This enables better memory update triggers based on user activity

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have a last_activity timestamp
UPDATE user_profiles 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- Add index for efficient session timeout queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_activity ON user_profiles(last_activity);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.last_activity IS 'Tracks when user was last active for session timeout detection and memory update triggers';
