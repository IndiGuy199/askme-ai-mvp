-- Add challenge support to action_plans and progress tables

-- Add challenge_id column to action_plans table
ALTER TABLE action_plans 
ADD COLUMN challenge_id TEXT;

-- Add challenge_id column to progress table  
ALTER TABLE progress 
ADD COLUMN challenge_id TEXT;

-- Add constraint to ensure either goal_id or challenge_id is present in action_plans
ALTER TABLE action_plans 
ADD CONSTRAINT check_goal_or_challenge_action 
CHECK ((goal_id IS NOT NULL) OR (challenge_id IS NOT NULL));

-- Add constraint to ensure either goal_id or challenge_id is present in progress
ALTER TABLE progress 
ADD CONSTRAINT check_goal_or_challenge_progress 
CHECK ((goal_id IS NOT NULL) OR (challenge_id IS NOT NULL));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_action_plans_challenge_id ON action_plans(challenge_id);
CREATE INDEX IF NOT EXISTS idx_progress_challenge_id ON progress(challenge_id);

-- Insert some sample challenges for the default coach profile
INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT 
  cp.id,
  'addiction_recovery',
  'Recovering from Addiction',
  'Commit to living a life free from substances',
  1
FROM coach_profiles cp
WHERE cp.code = 'askme'
ON CONFLICT DO NOTHING;

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT 
  cp.id,
  'anxiety_management',
  'Managing Anxiety',
  'Develop healthy coping strategies for anxiety',
  2
FROM coach_profiles cp
WHERE cp.code = 'askme'
ON CONFLICT DO NOTHING;

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT 
  cp.id,
  'stress_reduction',
  'Reducing Stress',
  'Build resilience and manage daily stressors',
  3
FROM coach_profiles cp
WHERE cp.code = 'askme'
ON CONFLICT DO NOTHING;

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT 
  cp.id,
  'depression_support',
  'Depression Support',
  'Finding motivation and building positive habits',
  4
FROM coach_profiles cp
WHERE cp.code = 'askme'
ON CONFLICT DO NOTHING;
