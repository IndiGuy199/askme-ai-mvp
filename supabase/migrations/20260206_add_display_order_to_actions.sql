-- Migration: Add display_order to action_plans for action ordering
-- Date: 2026-02-06
-- Description: Adds display_order column to allow users to reorder their actions

-- Add display_order column if it doesn't exist
ALTER TABLE action_plans 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add primary_track column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS primary_track TEXT DEFAULT 'porn' CHECK (primary_track IN ('porn', 'sex', 'food'));

-- Create index for better ordering performance
CREATE INDEX IF NOT EXISTS idx_action_plans_display_order ON action_plans(user_id, display_order);

-- Update existing actions to have sequential display_order based on created_at
WITH ordered_actions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as new_order
  FROM action_plans
)
UPDATE action_plans ap
SET display_order = oa.new_order
FROM ordered_actions oa
WHERE ap.id = oa.id;

-- Add comment for documentation
COMMENT ON COLUMN action_plans.display_order IS 'Order in which actions are displayed. Top 3 appear on playbook.';
COMMENT ON COLUMN users.primary_track IS 'User''s primary recovery track: porn, sex, or food';
