-- ============================================================
-- Migration: Exit Metrics + Lightweight Baselines
-- Date: 2026-02-14
-- Purpose:
--   A) Add rating/reason/swapped-to columns to user_goal_events & user_action_events
--      so swap-out check-in feedback can be captured.
--   B) Add baseline_level column to user_goal_events for lightweight create-time capture.
--   C) Add baseline_confidence_1_4 column to user_action_events for create-time capture.
--   D) Expand event_type enums to include 'create', 'swap_out', 'swap_in'.
--   E) Add extra indexes for analytics queries.
--
-- Analytics can later query:
--   - AVG(rating_1_4) of actions swapped out per goal
--   - AVG(rating_1_4) of goals swapped out per track
--   - Common reason_codes via GROUP BY reason_code
--   - Baseline level at creation vs later swap-out rating (join on goal_id + event_type)
-- ============================================================

-- ============================================
-- 1) Alter user_goal_events
-- ============================================

-- Drop and recreate the CHECK constraint to add new event types
ALTER TABLE user_goal_events DROP CONSTRAINT IF EXISTS user_goal_events_event_type_check;
ALTER TABLE user_goal_events ADD CONSTRAINT user_goal_events_event_type_check
  CHECK (event_type IN ('add', 'swap', 'remove', 'baseline_update', 'create', 'swap_out', 'swap_in', 'complete', 'archive'));

-- Add new columns for exit metrics + baseline
ALTER TABLE user_goal_events
  ADD COLUMN IF NOT EXISTS challenge_id TEXT,
  ADD COLUMN IF NOT EXISTS goal_id UUID,
  ADD COLUMN IF NOT EXISTS baseline_level TEXT
    CHECK (baseline_level IN ('not_started', 'inconsistent', 'some_progress', 'mostly_consistent')),
  ADD COLUMN IF NOT EXISTS rating_1_4 INT CHECK (rating_1_4 BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS swapped_to_goal_id UUID;

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_uge_goal_event
  ON user_goal_events(goal_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uge_user_challenge
  ON user_goal_events(user_id, challenge_id, created_at DESC);


-- ============================================
-- 2) Alter user_action_events
-- ============================================

-- Drop and recreate the CHECK constraint to add new event types
ALTER TABLE user_action_events DROP CONSTRAINT IF EXISTS user_action_events_event_type_check;
ALTER TABLE user_action_events ADD CONSTRAINT user_action_events_event_type_check
  CHECK (event_type IN ('add', 'swap', 'remove', 'baseline_update', 'create', 'swap_out', 'swap_in', 'retire'));

-- Add new columns for exit metrics + baseline
ALTER TABLE user_action_events
  ADD COLUMN IF NOT EXISTS goal_id UUID,
  ADD COLUMN IF NOT EXISTS action_id UUID,
  ADD COLUMN IF NOT EXISTS baseline_confidence_1_4 INT CHECK (baseline_confidence_1_4 BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS rating_1_4 INT CHECK (rating_1_4 BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS swapped_to_action_id UUID;

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_uae_goal_created
  ON user_action_events(user_id, goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uae_action_created
  ON user_action_events(user_id, action_id, created_at DESC);
