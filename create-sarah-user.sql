-- SQL Script to Create Test User for AskMe AI Tests
-- Email: deeshop9821@gmail.com
-- Run this in your Supabase SQL editor or database client

-- Step 1: Create the main user record
-- Note: Adjust UUID generation method if your system uses a different approach
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
 -- updated_at,
  preferences_set,
  communication_style,
  coaching_format
) VALUES (
  gen_random_uuid(), -- Generate a new UUID for the user
  'deeshop9821@gmail.com',
  'Sarah',
  32,
  'Austin',
  'United States',
  'single',
  1000, -- Give plenty of tokens for testing
  NOW(),
  -- NOW(),
  true, -- Mark preferences as set
  'step-by-step', -- Default communication style
  'detailed' -- Default coaching format
) 
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  age = EXCLUDED.age,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  tokens = EXCLUDED.tokens,
  preferences_set = EXCLUDED.preferences_set
  --,  updated_at = NOW();

-- Step 2: Get the user ID for subsequent operations
-- (This will be used in the following steps)

-- Step 3: Create user profile record
INSERT INTO user_profiles (
  user_id,
  memory_summary,
  created_at,
  updated_at
)
SELECT 
  id,
  '', -- Start with empty memory summary
  NOW(),
  NOW()
FROM users 
WHERE email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  updated_at = NOW();

-- Step 4: Add user challenges
-- First, let's see what challenges are available
-- SELECT * FROM coach_challenges ORDER BY challenge_id;

-- Add specific challenges for our test user
-- Note: You may need to adjust the challenge_ids based on your actual data
INSERT INTO user_challenges (user_id, coach_challenge_id, selected_at)
SELECT 
  u.id,
  cc.id,
  NOW()
FROM users u
CROSS JOIN (
  SELECT id FROM coach_challenges 
  WHERE LOWER(label) LIKE '%anxiety%' 
     OR LOWER(label) LIKE '%depression%'
     OR LOWER(label) LIKE '%relationship%'
     OR LOWER(label) LIKE '%purpose%'
     OR LOWER(description) LIKE '%anxiety%'
     OR LOWER(description) LIKE '%depression%'
     OR LOWER(description) LIKE '%relationship%'
     OR LOWER(description) LIKE '%purpose%'
  LIMIT 4 -- Limit to 4 challenges max
) cc
WHERE u.email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, id) DO NOTHING;

-- Step 5: If the above doesn't find challenges, manually insert with specific IDs
-- (Uncomment and adjust these if needed)
/*
INSERT INTO user_challenges (user_id, challenge_id, created_at)
SELECT 
  id,
  1, -- Replace with actual anxiety challenge ID
  NOW()
FROM users WHERE email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, challenge_id) DO NOTHING;

INSERT INTO user_challenges (user_id, challenge_id, created_at)
SELECT 
  id,
  2, -- Replace with actual depression challenge ID
  NOW()
FROM users WHERE email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, challenge_id) DO NOTHING;

INSERT INTO user_challenges (user_id, challenge_id, created_at)
SELECT 
  id,
  3, -- Replace with actual relationship challenge ID
  NOW()
FROM users WHERE email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, challenge_id) DO NOTHING;

INSERT INTO user_challenges (user_id, challenge_id, created_at)
SELECT 
  id,
  4, -- Replace with actual purpose challenge ID
  NOW()
FROM users WHERE email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, challenge_id) DO NOTHING;
*/

-- Step 6: Assign a coach profile (if your system uses automatic assignment, this might not be needed)
-- First check what coach profiles are available
-- SELECT * FROM coach_profiles ORDER BY id;

-- Assign a coach based on challenges (adjust logic as needed)
UPDATE users 
SET coach_profile_id = (
  SELECT id FROM coach_profiles 
  WHERE code IS NOT NULL 
  LIMIT 1 -- Just assign the first available coach for testing
)
--,updated_at = NOW()
WHERE email = 'deeshop9821@gmail.com';

-- Step 7: Verification queries
-- Run these to verify everything was created correctly

-- Check user record
SELECT 
  id,
  email,
  first_name,
  age,
  city,
  country,
  tokens,
  coach_profile_id,
  preferences_set,
  created_at
FROM users 
WHERE email = 'deeshop9821@gmail.com';

-- Check user profile
SELECT 
  up.user_id,
  u.email,
  u.first_name,
  LENGTH(up.memory_summary) as memory_length,
  up.created_at
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.email = 'deeshop9821@gmail.com';

-- Check user challenges
SELECT 
  u.email,
  u.first_name,
  cc.challenge_id,
  cc.label,
  cc.description,
  uc.selected_at
FROM user_challenges uc
JOIN users u ON uc.user_id = u.id
JOIN coach_challenges cc ON uc.coach_challenge_id = cc.id
WHERE u.email = 'deeshop9821@gmail.com'
ORDER BY uc.selected_at;

-- Check coach assignment
SELECT 
  u.email,
  u.first_name,
  u.coach_profile_id,
  cp.code as coach_code,
  cp.label as coach_label
FROM users u
LEFT JOIN coach_profiles cp ON u.coach_profile_id = cp.id
WHERE u.email = 'deeshop9821@gmail.com';

-- Step 8: Optional - Add some wellness goals if your system tracks them separately
-- (Uncomment if you have a separate goals system)
/*
INSERT INTO user_wellness_goals (user_id, goal_id, created_at)
SELECT 
  u.id,
  wg.goal_id,
  NOW()
FROM users u
CROSS JOIN (
  SELECT goal_id FROM coach_wellness_goals 
  WHERE LOWER(label) LIKE '%mental%' 
     OR LOWER(label) LIKE '%relationship%'
     OR LOWER(label) LIKE '%life%'
  LIMIT 3
) wg
WHERE u.email = 'deeshop9821@gmail.com'
ON CONFLICT (user_id, goal_id) DO NOTHING;
*/

-- Final verification - complete user profile summary
SELECT 
  'USER PROFILE SUMMARY' as section,
  json_build_object(
    'user_id', u.id,
    'email', u.email,
    'name', u.first_name,
    'age', u.age,
    'location', u.city || ', ' || u.country,
    'tokens', u.tokens,
    'coach_assigned', CASE WHEN u.coach_profile_id IS NOT NULL THEN 'Yes' ELSE 'No' END,
    'profile_exists', CASE WHEN up.user_id IS NOT NULL THEN 'Yes' ELSE 'No' END,
    'challenges_count', challenge_count.count,
    'created_at', u.created_at
  ) as profile_data
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count 
  FROM user_challenges 
  WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com')
  GROUP BY user_id
) challenge_count ON u.id = challenge_count.user_id
WHERE u.email = 'deeshop9821@gmail.com';

-- Success message
SELECT 
  '✅ Test user created successfully!' as message,
  'Email: deeshop9821@gmail.com' as email,
  'Password: Set up through your authentication system' as password_note,
  'Ready for testing!' as status;
