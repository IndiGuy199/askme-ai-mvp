-- Migration: Enhance action logging with completion tracking
-- Created: 2025-02-11
-- Purpose: Add fields for partial completion with percentage and notes

-- Add new columns to action_completions table
ALTER TABLE action_completions 
ADD COLUMN IF NOT EXISTS completion_status TEXT DEFAULT 'done' CHECK (completion_status IN ('done', 'partial'));

ALTER TABLE action_completions 
ADD COLUMN IF NOT EXISTS completion_percent INTEGER CHECK (completion_percent >= 0 AND completion_percent <= 100);

ALTER TABLE action_completions 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE action_completions 
ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for faster queries on completion status and logged_at
CREATE INDEX IF NOT EXISTS idx_action_completions_status ON action_completions(completion_status);
CREATE INDEX IF NOT EXISTS idx_action_completions_logged_at ON action_completions(logged_at);

-- Add constraint: if status is partial, must have percent
-- Note: PostgreSQL check constraints can't reference multiple columns easily, so we'll validate in application layer

COMMENT ON COLUMN action_completions.completion_status IS 'Whether action was fully done or partially completed';
COMMENT ON COLUMN action_completions.completion_percent IS 'Percentage completed (0-100), optional';
COMMENT ON COLUMN action_completions.notes IS 'User notes about what they did';
COMMENT ON COLUMN action_completions.logged_at IS 'When the user logged this completion (may differ from completed_at for retroactive logging)';
