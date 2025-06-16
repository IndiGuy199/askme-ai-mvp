-- Add medium and short prompt columns to coach_profiles table
ALTER TABLE coach_profiles 
ADD COLUMN medium_prompt TEXT,
ADD COLUMN short_prompt TEXT;

-- Set a comment to document the columns
COMMENT ON COLUMN coach_profiles.system_prompt IS 'The full/long system prompt for the coach';
COMMENT ON COLUMN coach_profiles.medium_prompt IS 'The medium-length system prompt for the coach';
COMMENT ON COLUMN coach_profiles.short_prompt IS 'The short/concise system prompt for the coach';
