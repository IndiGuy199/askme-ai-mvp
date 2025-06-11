-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  coach_profile_id UUID REFERENCES coach_profiles(id),
  tokens INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- coach_profiles table
CREATE TABLE coach_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  brand_theme JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

-- promotions table
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_percent INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Coach-specific wellness goals
CREATE TABLE coach_wellness_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_profile_id UUID REFERENCES coach_profiles(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL, -- 'more_energy', 'better_sleep', etc.
  label TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  created_by TEXT DEFAULT 'system' CHECK (created_by IN ('system', 'user'))
);

-- Coach-specific challenges
CREATE TABLE coach_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_profile_id UUID REFERENCES coach_profiles(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL, -- 'anxiety', 'stress', etc.
  label TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

-- User selected goals and challenges (linking to coach-specific options)
CREATE TABLE user_wellness_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coach_wellness_goal_id UUID REFERENCES coach_wellness_goals(id) ON DELETE CASCADE,
  selected_at TIMESTAMP DEFAULT now()
);

CREATE TABLE user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coach_challenge_id UUID REFERENCES coach_challenges(id) ON DELETE CASCADE,
  selected_at TIMESTAMP DEFAULT now()
);

-- welcome token trigger
CREATE OR REPLACE FUNCTION grant_welcome_tokens()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET tokens = 20 WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_signup
AFTER INSERT ON users
FOR EACH ROW EXECUTE PROCEDURE grant_welcome_tokens();

-- Add user profile fields
ALTER TABLE users
  ADD COLUMN first_name TEXT,
  ADD COLUMN age INT,
  ADD COLUMN city TEXT,
  ADD COLUMN country TEXT,
  ADD COLUMN marital_status TEXT,
  ADD COLUMN goals TEXT,
  ADD COLUMN tone TEXT DEFAULT 'balanced',
  ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN last_login TIMESTAMP DEFAULT now();

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_coach_profile ON users(coach_profile_id);
CREATE INDEX idx_coach_wellness_goals_coach ON coach_wellness_goals(coach_profile_id);
CREATE INDEX idx_coach_challenges_coach ON coach_challenges(coach_profile_id);
CREATE INDEX idx_user_wellness_goals_user ON user_wellness_goals(user_id);
CREATE INDEX idx_user_challenges_user ON user_challenges(user_id);

-- Insert sample coach profiles
INSERT INTO coach_profiles (code, label, system_prompt) VALUES
('wellness', 'General Wellness Coach', 'You are a supportive wellness coach focused on holistic health and wellbeing.'),
('fitness', 'Fitness Coach', 'You are an energetic fitness coach specialized in physical health and exercise.'),
('mental_health', 'Mental Health Coach', 'You are a compassionate mental health coach focused on emotional wellbeing.');

-- Insert wellness goals for General Wellness Coach
INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'more_energy', 'More Energy', 'Increase daily energy levels and vitality', 1
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'better_sleep', 'Better Sleep', 'Improve sleep quality and duration', 2
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'stronger_habits', 'Stronger Habits', 'Build and maintain healthy daily habits', 3
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'lose_weight', 'Lose Weight', 'Achieve and maintain healthy weight', 4
FROM coach_profiles WHERE code = 'wellness';

-- Insert challenges for General Wellness Coach
INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT id, 'anxiety', 'Anxiety', 'Managing anxiety and worry', 1
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT id, 'anger', 'Anger', 'Managing anger and frustration', 2
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT id, 'depression', 'Depression', 'Dealing with depression and low mood', 3
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT id, 'relationship_issues', 'Relationship Issues', 'Improving relationships and communication', 4
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT id, 'grief', 'Grief', 'Processing grief and loss', 5
FROM coach_profiles WHERE code = 'wellness';

INSERT INTO coach_challenges (coach_profile_id, challenge_id, label, description, display_order) 
SELECT id, 'procrastination', 'Procrastination', 'Overcoming procrastination and building motivation', 6
FROM coach_profiles WHERE code = 'wellness';

-- Insert fitness-specific goals
INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'build_muscle', 'Build Muscle', 'Increase muscle mass and strength', 1
FROM coach_profiles WHERE code = 'fitness';

INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'lose_fat', 'Lose Fat', 'Reduce body fat percentage', 2
FROM coach_profiles WHERE code = 'fitness';

INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'improve_endurance', 'Improve Endurance', 'Enhance cardiovascular fitness', 3
FROM coach_profiles WHERE code = 'fitness';

INSERT INTO coach_wellness_goals (coach_profile_id, goal_id, label, description, display_order) 
SELECT id, 'flexibility', 'Better Flexibility', 'Improve mobility and flexibility', 4
FROM coach_profiles WHERE code = 'fitness';

-- Track progress for each user-goal
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  progress_percent INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT now(),
  notes TEXT
);

-- Store recommended actions for each user
CREATE TABLE IF NOT EXISTS action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT,
  action_text TEXT NOT NULL,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_user ON action_plans(user_id);
