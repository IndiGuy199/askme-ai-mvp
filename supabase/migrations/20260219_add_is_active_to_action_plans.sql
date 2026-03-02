-- Add is_active column to action_plans
-- Controls whether an action is in the user's active set (max 3 per goal).
-- Default true so existing rows remain visible in the playbook immediately.

ALTER TABLE action_plans
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_action_plans_is_active
  ON action_plans(user_id, is_active);

-- Backfill: for each user+goal, mark only the first 3 (by display_order then created_at)
-- as is_active=true and deactivate the rest.  This matches the previous .slice(0,3) logic
-- that was applied in the UI.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, goal_id
      ORDER BY
        COALESCE(display_order, 9999) ASC,
        created_at ASC
    ) AS rn
  FROM action_plans
  WHERE is_complete = false
)
UPDATE action_plans
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 3
);

COMMENT ON COLUMN action_plans.is_active IS
  'Whether this action is in the user''s active set for its goal. Max 3 per active goal. '
  'Inactive actions still exist (e.g. previously swapped-out) and can be swapped back in.';
