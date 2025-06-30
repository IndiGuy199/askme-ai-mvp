-- SQL Script to Create Test User for AskMe AI Tests
-- LEGACY FILE - Use create-sarah-user.sql instead
-- This file is kept for reference but use the updated script
-- Email: deeshop9821@gmail.com
-- Run this in your Supabase SQL editor or database client

-- 1. Insert test user (adjust the ID generation based on your setup)
INSERT INTO users (
  id,
  email,
  first_name,
  age,
  city,
  country,
  marital_status,
  tokens,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(), -- or use your preferred UUID generation
  'deeshop9821@gmail.com',
  'Sarah',
  32,
  'Austin',
  'United States',
  'single',
  1000,
  NOW(),
  NOW()
) 
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  age = EXCLUDED.age,
  tokens = EXCLUDED.tokens,
  updated_at = NOW();

-- 2. Get the user ID for subsequent inserts
-- Note: You'll need to select challenges from your coach_challenges table
-- and goals from your coach_wellness_goals table based on your current setup

-- 3. Example: Insert user challenges (adjust challenge IDs based on your data)
-- This is just an example - use actual IDs from your coach_challenges table
INSERT INTO user_challenges (user_id, challenge_id)
SELECT 
  u.id,
  cc.challenge_id
FROM users u
CROSS JOIN (
  SELECT challenge_id FROM coach_challenges 
  WHERE label IN ('Anxiety', 'Depression', 'Relationship Issues', 'Finding Purpose')
) cc
WHERE u.email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, challenge_id) DO NOTHING;

-- 4. Create user profile (if your system requires it)
INSERT INTO user_profiles (
  user_id,
  memory_summary,
  created_at,
  updated_at
)
SELECT 
  id,
  '',
  NOW(),
  NOW()
FROM users 
WHERE email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 5. Verify the user was created
SELECT 
  id,
  email,
  first_name,
  age,
  city,
  country,
  tokens,
  created_at
FROM users 
WHERE email = 'deeshop9821@gmail.com';

-- 6. Check user challenges
SELECT 
  u.email,
  u.first_name,
  cc.label as challenge
FROM users u
JOIN user_challenges uc ON u.id = uc.user_id
JOIN coach_challenges cc ON uc.challenge_id = cc.challenge_id
WHERE u.email = 'deeshop9821@gmail.com';

-- 7. Check if user profile exists
SELECT 
  up.user_id,
  u.email,
  u.first_name,
  LENGTH(up.memory_summary) as memory_length
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.email = 'deeshop9821@gmail.com';
