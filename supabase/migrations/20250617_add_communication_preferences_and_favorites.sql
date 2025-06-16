-- Step 1: Add columns with default values (no constraints yet)
ALTER TABLE users
  ADD COLUMN communication_style TEXT DEFAULT 'balanced',
  ADD COLUMN coaching_format TEXT DEFAULT 'conversational',
  ADD COLUMN preferences_set BOOLEAN DEFAULT FALSE;

-- Step 2: Update any NULL values to defaults (shouldn't be needed with DEFAULT, but just in case)
UPDATE users 
SET 
  communication_style = 'balanced'
WHERE communication_style IS NULL;

UPDATE users 
SET 
  coaching_format = 'conversational'
WHERE coaching_format IS NULL;

UPDATE users 
SET 
  preferences_set = FALSE
WHERE preferences_set IS NULL;

-- Step 3: Add CHECK constraints
ALTER TABLE users 
  ADD CONSTRAINT users_communication_style_check 
  CHECK (communication_style IN ('direct', 'step-by-step', 'gentle-encouraging', 'balanced'));

ALTER TABLE users 
  ADD CONSTRAINT users_coaching_format_check 
  CHECK (coaching_format IN ('concise', 'detailed', 'conversational'));

-- Create user_favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Option 1: Update database to match API
ALTER TABLE user_favorites 
RENAME COLUMN content TO message_content;

-- Add the missing message_role column
ALTER TABLE user_favorites 
ADD COLUMN message_role TEXT NOT NULL DEFAULT 'assistant';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_category ON user_favorites(category);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at);

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
