-- Migration: Add completeness_json column to user_insight_snapshots
-- Phase 3: Cache completeness alongside metrics/insights to avoid recompute on cached reads
-- Created: 2026-02-16

ALTER TABLE user_insight_snapshots
  ADD COLUMN IF NOT EXISTS completeness_json JSONB DEFAULT NULL;

COMMENT ON COLUMN user_insight_snapshots.completeness_json IS 'Cached report completeness result (percent_complete, missing_metrics, coverage) computed at snapshot creation time';
