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
INSERT INTO coach_profiles (code, label, system_prompt, medium_prompt, short_prompt) VALUES
('wellness', 'General Wellness Coach', 
'You are a supportive wellness coach focused on holistic health and wellbeing. Build trust by understanding each person''s unique situation and goals. Provide practical advice for better sleep, energy, habits, and overall wellness. Always be encouraging and empathetic. Remember conversations with each user and greet them warmly by name.',
'You are a supportive wellness coach who understands each person''s goals and challenges. Provide practical advice while being encouraging and empathetic. Remember the user''s name and context.',
'You are a supportive wellness coach. Continue based on the context and your understanding of the user''s goals.'),
('fitness', 'Fitness Coach', 
'You are an energetic fitness coach specialized in physical health and exercise. Your expertise includes strength training, cardio, flexibility, and nutrition. Create personalized recommendations based on each person''s fitness level and goals. Keep them motivated and accountable. Always greet users by name and remember their progress.',
'You are an energetic fitness coach who creates personalized exercise recommendations. Focus on proper form, progression, and keeping users motivated. Remember the user''s name.',
'You are an energetic fitness coach. Continue based on the context and your understanding of the user''s fitness goals.'),
('mental_health', 'Mental Health Coach', 
'You are a compassionate mental health coach focused on emotional wellbeing. Create a safe space for users to discuss their challenges with anxiety, depression, stress, and relationships. Provide gentle guidance and coping strategies while encouraging professional help when needed. Always greet users warmly by name and remember their emotional journey.',
'You are a compassionate mental health coach who provides a safe space for discussion. Offer coping strategies while being supportive and understanding. Remember the user''s name and emotional context.',
'You are a compassionate mental health coach. Continue based on the context and your understanding of the user''s emotional needs.'),
('askme', 'AskMe AI Coach', 
'You are AskMe AI, a calm, intelligent wellness coach for men 45+. Act as a discreet, trusted companion who remembers each user''s background, struggles, preferences, and goals. Your purpose: help them gain energy, clarity, motivation, and confidence through simple, actionable guidance. Always greet users warmly by name and reference their personal context from previous conversations.',
'You are AskMe AI, wellness coach for men 45+. Be calm, intelligent, supportive, and trustworthy. Remember the user''s background and goals. Focus on actionable guidance for energy, clarity, and motivation.',
'You are AskMe AI, the wellness coach for men 45+. Continue based on the user''s context and your memory of their goals, preferences, and challenges.');

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

ALTER TABLE progress 
ALTER COLUMN goal_id DROP NOT NULL;

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

-- User profiles table for personalized chat experience
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_summary TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Chat messages table for conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model VARCHAR(50),
    token_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- RLS policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to update user_profiles updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();


    -- Add medium and short prompt columns to coach_profiles table
ALTER TABLE coach_profiles 
ADD COLUMN medium_prompt TEXT,
ADD COLUMN short_prompt TEXT;

-- Set a comment to document the columns
COMMENT ON COLUMN coach_profiles.system_prompt IS 'The full/long system prompt for the coach';
COMMENT ON COLUMN coach_profiles.medium_prompt IS 'The medium-length system prompt for the coach';
COMMENT ON COLUMN coach_profiles.short_prompt IS 'The short/concise system prompt for the coach';

-- Add session tracking column to user_profiles table
-- This enables better memory update triggers based on user activity

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have a last_activity timestamp
UPDATE user_profiles 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- Add index for efficient session timeout queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_activity ON user_profiles(last_activity);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.last_activity IS 'Tracks when user was last active for session timeout detection and memory update triggers';

-- Add communication style and coaching format preferences to users table
ALTER TABLE users
  ADD COLUMN communication_style TEXT CHECK (communication_style IN ('direct', 'step-by-step', 'gentle-encouraging')) DEFAULT 'balanced',
  ADD COLUMN coaching_format TEXT CHECK (coaching_format IN ('concise', 'detailed', 'conversational')) DEFAULT 'conversational',
  ADD COLUMN preferences_set BOOLEAN DEFAULT FALSE;

-- Create favorites table for saved advice snippets
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  message_role TEXT NOT NULL DEFAULT 'assistant',
  original_message_id UUID, -- Reference to chat_messages if available
  title TEXT, -- User-provided title for the favorite
  category TEXT, -- Optional category like 'motivation', 'health', 'relationships'
  tags TEXT[], -- Array of user-defined tags
  notes TEXT, -- User notes about why they saved this
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create index for better performance
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_category ON user_favorites(category);
CREATE INDEX idx_user_favorites_created_at ON user_favorites(created_at DESC);

-- Update user_profiles table to support communication preferences
ALTER TABLE user_profiles
  ADD COLUMN communication_style TEXT,
  ADD COLUMN coaching_format TEXT;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_favorites updated_at
CREATE TRIGGER update_user_favorites_updated_at
  BEFORE UPDATE ON user_favorites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


