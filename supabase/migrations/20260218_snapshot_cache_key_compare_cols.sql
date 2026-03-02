-- Migration: Add cache_key + compare columns to user_insight_snapshots
-- Phase D: Allows deterministic keying and compare-snapshot persistence
-- Created: 2026-02-18

ALTER TABLE user_insight_snapshots
  ADD COLUMN IF NOT EXISTS cache_key TEXT GENERATED ALWAYS AS (
    user_id::text || ':' || track_id || ':' || range_key || ':' || compare_mode
  ) STORED,
  ADD COLUMN IF NOT EXISTS compare_metrics_json  JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compare_insights_json JSONB DEFAULT NULL;

-- Index for fast cache lookups by deterministic key
CREATE INDEX IF NOT EXISTS idx_insight_snapshots_cache_key
  ON user_insight_snapshots (cache_key, created_at DESC);

COMMENT ON COLUMN user_insight_snapshots.cache_key IS
  'Deterministic cache key: user_id:track_id:range_key:compare_mode';
COMMENT ON COLUMN user_insight_snapshots.compare_metrics_json IS
  'Metrics for the compare period (null when compare_mode=none)';
COMMENT ON COLUMN user_insight_snapshots.compare_insights_json IS
  'AI insights for the compare period (null when compare_mode=none)';
