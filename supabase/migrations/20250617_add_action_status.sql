-- Add status column to action_plans table to distinguish between suggested and accepted actions

-- Add status column with default value
ALTER TABLE action_plans 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted'));

-- Add accepted_at timestamp for tracking when actions were accepted
ALTER TABLE action_plans 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

-- Update existing action_plans to have 'suggested' status
UPDATE action_plans 
SET status = 'suggested' 
WHERE status IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_action_plans_status ON action_plans(status);
CREATE INDEX IF NOT EXISTS idx_action_plans_user_status ON action_plans(user_id, status);
