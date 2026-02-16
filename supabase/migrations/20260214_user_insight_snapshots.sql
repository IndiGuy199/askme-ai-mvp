-- Create user_insight_snapshots table for caching computed metrics + AI insights
-- This enables fast report rendering with time-range filtering and comparison modes

CREATE TABLE IF NOT EXISTS user_insight_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL, -- e.g., 'porn', 'mental_health'
  range_key TEXT NOT NULL, -- 'last_7_days', 'last_30_days', 'last_90_days', 'since_beginning'
  compare_mode TEXT NOT NULL DEFAULT 'none', -- 'previous_period', 'baseline', 'none'
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  
  -- Computed metrics (single source of truth)
  metrics_json JSONB NOT NULL,
  
  -- AI-generated insights
  insights_json JSONB NOT NULL,
  
  -- Versioning for future schema changes
  version INT NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one snapshot per user/trade/range/compare/time period
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_insight_snapshots_unique 
  ON user_insight_snapshots(user_id, track_id, range_key, compare_mode, start_at, end_at);

-- Query optimization: find recent snapshots for a user/track/range
CREATE INDEX IF NOT EXISTS idx_user_insight_snapshots_lookup
  ON user_insight_snapshots(user_id, track_id, range_key, compare_mode, created_at DESC);

-- Query optimization: cleanup old snapshots
CREATE INDEX IF NOT EXISTS idx_user_insight_snapshots_cleanup
  ON user_insight_snapshots(created_at DESC);

-- Enable RLS
ALTER TABLE user_insight_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own snapshots
CREATE POLICY "Users can view their own insight snapshots"
  ON user_insight_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insight snapshots"
  ON user_insight_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insight snapshots"
  ON user_insight_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insight snapshots"
  ON user_insight_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: automatic cleanup of old snapshots (keep last 90 days)
-- Run via scheduled job or manual cleanup script
-- DELETE FROM user_insight_snapshots WHERE created_at < NOW() - INTERVAL '90 days';

COMMENT ON TABLE user_insight_snapshots IS 'Caches computed metrics and AI insights for fast report rendering with 6-hour TTL';
COMMENT ON COLUMN user_insight_snapshots.metrics_json IS 'Compact metrics object: activity, urge, risk_window, tools, baselines, slips, meta';
COMMENT ON COLUMN user_insight_snapshots.insights_json IS 'AI-generated insights: risk_window, best_tool, best_lever, insights array, next_experiment';
