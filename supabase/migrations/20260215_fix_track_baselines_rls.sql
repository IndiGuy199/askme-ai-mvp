-- ============================================================
-- Fix RLS policy for user_track_baselines
-- Issue: Policy uses auth.email() lookup instead of auth.uid()
-- Result: Frontend queries fail to fetch saved baselines
-- ============================================================

-- Drop old policy
DROP POLICY IF EXISTS "utb_own" ON user_track_baselines;

-- Create correct policy using auth.uid() (matches other tables)
CREATE POLICY "Users can manage their own track baselines" 
  ON user_track_baselines
  FOR ALL 
  USING (user_id = auth.uid());

-- Verify policy is active
COMMENT ON TABLE user_track_baselines IS 'Track-level baseline metrics. RLS: user_id = auth.uid()';
