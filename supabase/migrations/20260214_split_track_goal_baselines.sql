-- ============================================================
-- Migration: Split track vs goal baselines
-- Created: 2026-02-14
-- Purpose:
--   - Create user_track_baselines for track-level metrics (porn recovery overall)
--   - Update user_goal_baselines to only store goal-specific data
--   - Prevent duplication of track-level data on every goal
-- ============================================================

-- 1) Create user_track_baselines table
CREATE TABLE IF NOT EXISTS user_track_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL, -- e.g., 'porn_recovery', 'mental_health'
  
  -- Track-level snapshot fields (all required when saving)
  slip_frequency_30d TEXT NOT NULL CHECK (slip_frequency_30d IN ('none', '1_2', 'weekly', 'most_days', 'daily')),
  longest_streak_90d TEXT NOT NULL CHECK (longest_streak_90d IN ('lt_3d', '3_7d', '1_3w', '1m_plus')),
  strongest_urge_time TEXT NOT NULL CHECK (strongest_urge_time IN ('morning', 'afternoon', 'evening', 'late_night')),
  biggest_trigger TEXT NOT NULL CHECK (biggest_trigger IN ('boredom', 'stress', 'loneliness', 'anxiety', 'conflict', 'other')),
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one baseline per user per track
  UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_utb_user_track ON user_track_baselines(user_id, track_id);
CREATE INDEX IF NOT EXISTS idx_utb_user_updated ON user_track_baselines(user_id, updated_at DESC);

-- 2) Add goal-specific fields to user_goal_baselines (if not exists)
ALTER TABLE user_goal_baselines
  ADD COLUMN IF NOT EXISTS goal_baseline_level TEXT CHECK (goal_baseline_level IN ('not_started', 'inconsistent', 'some_progress', 'mostly_consistent')),
  ADD COLUMN IF NOT EXISTS goal_obstacle_text TEXT;

-- 3) RLS for user_track_baselines
ALTER TABLE user_track_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utb_own" ON user_track_baselines;
CREATE POLICY "utb_own" ON user_track_baselines
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE email = auth.email())
  );

-- 4) Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_track_baseline_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_track_baseline_timestamp ON user_track_baselines;
CREATE TRIGGER trigger_update_track_baseline_timestamp
  BEFORE UPDATE ON user_track_baselines
  FOR EACH ROW
  EXECUTE FUNCTION update_track_baseline_timestamp();

-- ============================================================
-- NOTES:
-- - Existing user_goal_baselines rows with track-level data remain for history
-- - Going forward, track data goes to user_track_baselines only
-- - Goal data (goal_baseline_level, goal_obstacle_text, confidence_0_10) goes to user_goal_baselines
-- ============================================================
