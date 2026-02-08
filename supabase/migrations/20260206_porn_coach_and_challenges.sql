-- Migration: Add porn coach and update challenges
-- Date: 2026-02-06
-- Description: 
--   1. Deactivate all existing challenges
--   2. Add new porn coach profile with supportive prompts
--   3. Add three new active challenges (porn, sex, food)
--   4. Associate rdee199@gmail.com with the porn coach

-- Step 1: Deactivate all existing challenges
UPDATE coach_challenges 
SET is_active = FALSE;

-- Step 2: Insert new porn coach profile
INSERT INTO coach_profiles (code, label, system_prompt, medium_prompt, short_prompt, is_active) VALUES
(
  'porn_coach', 
  'Porn Addiction Recovery Coach',
  'You are a compassionate and non-judgmental recovery coach specializing in pornography addiction. You understand the shame, guilt, and struggle that comes with this challenge. Create a safe, confidential space where users can be honest about their struggles without fear of judgment. Your approach combines empathy with practical strategies for recovery including: identifying triggers, building healthy coping mechanisms, understanding the neuroscience of addiction, developing accountability systems, and rebuilding self-worth and healthy relationships. Celebrate small victories and normalize setbacks as part of the recovery journey. Encourage professional help when needed. Always greet users warmly by name and remember their progress, triggers, and personal goals. Focus on building a sustainable recovery plan tailored to each individual''s circumstances.',
  'You are a compassionate porn addiction recovery coach. Provide a judgment-free space, practical recovery strategies, and celebrate progress. Help identify triggers, build healthy habits, and maintain accountability. Remember the user''s name and recovery journey.',
  'You are a compassionate recovery coach specializing in porn addiction. Continue supporting based on the user''s recovery context and goals.'
);

-- Step 3: Get the porn_coach profile ID and insert new challenges
DO $$
DECLARE
  porn_coach_id UUID;
  addiction_category_id INTEGER;
BEGIN
  -- Get the porn coach profile ID
  SELECT id INTO porn_coach_id 
  FROM coach_profiles 
  WHERE code = 'porn_coach';

  -- Get or create the addiction_recovery category
  SELECT id INTO addiction_category_id 
  FROM challenge_categories 
  WHERE code = 'addiction_recovery';

  -- If category doesn't exist, we'll leave category_id as NULL
  -- Insert the three new challenges as active
  
  -- Porn addiction challenge
  INSERT INTO coach_challenges (
    coach_profile_id, 
    challenge_id, 
    label, 
    description, 
    display_order, 
    is_active,
    category_id
  ) VALUES (
    porn_coach_id,
    'porn_addiction',
    'Pornography Addiction',
    'Overcoming compulsive pornography use and building healthy sexuality',
    1,
    TRUE,
    addiction_category_id
  );

  -- Sex addiction challenge
  INSERT INTO coach_challenges (
    coach_profile_id, 
    challenge_id, 
    label, 
    description, 
    display_order, 
    is_active,
    category_id
  ) VALUES (
    porn_coach_id,
    'sex_addiction',
    'Sexual Compulsivity',
    'Managing compulsive sexual behaviors and building healthy intimacy',
    2,
    TRUE,
    addiction_category_id
  );

  -- Food addiction challenge
  INSERT INTO coach_challenges (
    coach_profile_id, 
    challenge_id, 
    label, 
    description, 
    display_order, 
    is_active,
    category_id
  ) VALUES (
    porn_coach_id,
    'food_addiction',
    'Food Addiction',
    'Overcoming emotional eating and building a healthy relationship with food',
    3,
    TRUE,
    addiction_category_id
  );

END $$;

-- Step 4: Associate user rdee199@gmail.com with the porn coach
UPDATE users 
SET coach_profile_id = (
  SELECT id 
  FROM coach_profiles 
  WHERE code = 'porn_coach'
)
WHERE email = 'rdee199@gmail.com';

-- Verification queries (commented out - uncomment to verify)
-- SELECT * FROM coach_profiles WHERE code = 'porn_coach';
-- SELECT * FROM coach_challenges WHERE is_active = TRUE;
-- SELECT email, coach_profile_id FROM users WHERE email = 'rdee199@gmail.com';
