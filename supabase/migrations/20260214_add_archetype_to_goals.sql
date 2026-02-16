-- Add archetype field and baseline capture fields to coach_wellness_goals
-- Part of Porn Recovery AI Prompt Strategy implementation
-- Adds archetype classification, baseline_capture_question, baseline_capture_type

ALTER TABLE coach_wellness_goals
ADD COLUMN IF NOT EXISTS archetype TEXT
CHECK (archetype IN (
  'POST_SLIP_CONTAINMENT',
  'BEDTIME_RISK_WINDOW',
  'ACCESS_PATHWAY_BLOCK',
  'BORED_ALONE_LOOP',
  'STRESS_ESCAPE',
  'FANTASY_SPIRAL',
  'ACCOUNTABILITY_BUILD'
));

ALTER TABLE coach_wellness_goals
ADD COLUMN IF NOT EXISTS baseline_capture_question TEXT;

ALTER TABLE coach_wellness_goals
ADD COLUMN IF NOT EXISTS baseline_capture_type TEXT
CHECK (baseline_capture_type IN (
  'numeric',
  'yes_no',
  'text'
));

-- Add comment for documentation
COMMENT ON COLUMN coach_wellness_goals.archetype IS 'Goal archetype classification for prompt variety and rotation';
COMMENT ON COLUMN coach_wellness_goals.baseline_capture_question IS 'Question to ask user for baseline measurement (e.g., "How many hours per day?")';
COMMENT ON COLUMN coach_wellness_goals.baseline_capture_type IS 'Type of expected baseline answer';
