-- Create coach_prompts table for storing custom AI prompts
CREATE TABLE IF NOT EXISTS coach_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_profile_id UUID NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  full_prompt TEXT,
  medium_prompt TEXT,
  short_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment to document the table
COMMENT ON TABLE coach_prompts IS 'Stores custom AI prompt configurations for each coach profile';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS coach_prompts_coach_profile_id_idx ON coach_prompts(coach_profile_id);

-- Create or replace function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_coach_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before update
CREATE TRIGGER update_coach_prompts_timestamp
BEFORE UPDATE ON coach_prompts
FOR EACH ROW
EXECUTE FUNCTION update_coach_prompts_updated_at();

-- Create RLS policies
ALTER TABLE coach_prompts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view their own coach prompts
CREATE POLICY coach_prompts_select_policy ON coach_prompts
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM coach_profiles WHERE id = coach_profile_id
    )
  );

-- Create policy to allow authenticated users to insert their own coach prompts
CREATE POLICY coach_prompts_insert_policy ON coach_prompts
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM coach_profiles WHERE id = coach_profile_id
    )
  );

-- Create policy to allow authenticated users to update their own coach prompts
CREATE POLICY coach_prompts_update_policy ON coach_prompts
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM coach_profiles WHERE id = coach_profile_id
    )
  );

-- Create policy to allow authenticated users to delete their own coach prompts
CREATE POLICY coach_prompts_delete_policy ON coach_prompts
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM coach_profiles WHERE id = coach_profile_id
    )
  );
