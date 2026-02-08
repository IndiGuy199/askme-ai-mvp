-- Add is_active column to user_wellness_goals table
-- This enables the 2-goal + Library system

ALTER TABLE user_wellness_goals 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for faster active goal queries
CREATE INDEX IF NOT EXISTS idx_user_wellness_goals_active 
ON user_wellness_goals(user_id, is_active);

-- Add comment explaining the system
COMMENT ON COLUMN user_wellness_goals.is_active IS 
'Indicates if goal is actively displayed on playbook (max 2 active per user) or stored in library';

-- Update existing goals to be active (for backwards compatibility)
UPDATE user_wellness_goals 
SET is_active = true 
WHERE is_active IS NULL;

-- Set is_active to NOT NULL after backfilling
ALTER TABLE user_wellness_goals 
ALTER COLUMN is_active SET NOT NULL;
