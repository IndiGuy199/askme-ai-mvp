-- ============================================================
-- Migration: Add coach AI usage tracking (separate from chat)
-- Created: 2026-02-07
-- Purpose:
--   Track token usage and performance for Coach AI outputs
--   (goals, actions, insights) separately from chat system
-- ============================================================

-- Create table for Coach AI usage logs
CREATE TABLE IF NOT EXISTS coach_ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who used it
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- What type of generation
    kind TEXT NOT NULL CHECK (kind IN ('goals', 'actions', 'insights')),
    
    -- Token usage
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    
    -- Success tracking
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics and user lookups
CREATE INDEX IF NOT EXISTS idx_coach_ai_logs_user 
    ON coach_ai_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_ai_logs_kind 
    ON coach_ai_usage_logs (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_ai_logs_success 
    ON coach_ai_usage_logs (success, created_at DESC);

-- Comments
COMMENT ON TABLE coach_ai_usage_logs IS 'Tracks Coach AI (goals/actions/insights) usage separately from chat. Used for token accounting and performance monitoring.';
COMMENT ON COLUMN coach_ai_usage_logs.kind IS 'Type of Coach AI generation: goals, actions, or insights';
COMMENT ON COLUMN coach_ai_usage_logs.success IS 'Whether the generation completed successfully (false = used fallback)';

-- RLS policies
ALTER TABLE coach_ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view their own coach AI logs"
    ON coach_ai_usage_logs
    FOR SELECT
    USING (
        user_id IN (SELECT id FROM users WHERE email = auth.email())
    );

-- Service role can insert (API handles writes)
-- No direct INSERT/UPDATE/DELETE policies for end users

-- ============================================================
-- Optional: View for daily Coach AI usage summary
-- ============================================================
CREATE OR REPLACE VIEW coach_ai_daily_usage AS
SELECT
    user_id,
    DATE(created_at) AS date,
    kind,
    COUNT(*) AS generation_count,
    SUM(total_tokens) AS total_tokens_used,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_count,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failed_count
FROM coach_ai_usage_logs
GROUP BY user_id, DATE(created_at), kind;

COMMENT ON VIEW coach_ai_daily_usage IS 'Daily summary of Coach AI usage per user per generation type';

-- Grant SELECT on view to authenticated users (they can only see their own via RLS on base table)
GRANT SELECT ON coach_ai_daily_usage TO authenticated;
