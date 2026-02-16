-- Add coach_metadata JSONB column to action_plans
-- Stores AI-generated enrichment data: trigger_condition, mechanism_type, ai_note, etc.
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS coach_metadata JSONB DEFAULT NULL;

-- Add status and display_order columns if missing (may already exist from earlier migrations)
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted';
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS challenge_id TEXT DEFAULT NULL;

-- Comment on the new column
COMMENT ON COLUMN action_plans.coach_metadata IS 'AI-generated action enrichment data: {trigger_condition, mechanism_type, ai_note, category, duration_minutes, difficulty, success_criteria, when_to_do}';
