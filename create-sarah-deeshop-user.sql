-- Create Sarah test user with deeshop9821@gmail.com
-- This SQL creates a test user following the current onboarding flow:
-- 1. Basic profile info (name, age, sex, ethnicity, location)
-- 2. Challenge selections (anxiety, depression, relationship issues, finding purpose)
-- 3. Token allocation for testing

-- First, check if user already exists
SELECT 'Checking if user exists...' as status;
SELECT id, email, name FROM users WHERE email = 'deeshop9821@gmail.com';

-- Delete existing user if needed (uncomment if you want to recreate)
-- DELETE FROM user_challenges WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com');
-- DELETE FROM user_profiles WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com');
-- DELETE FROM chat_messages WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com');
-- DELETE FROM chat_chunks WHERE user_id = (SELECT id FROM users WHERE email = 'deeshop9821@gmail.com');
-- DELETE FROM users WHERE email = 'deeshop9821@gmail.com';

-- Create the user account
INSERT INTO users (
    email,
    name,
    age,
    sex,
    ethnicity,
    location,
    tokens_remaining,
    total_messages,
    last_active,
    created_at,
    updated_at
) VALUES (
    'deeshop9821@gmail.com',
    'Sarah',
    32,
    'Female',
    'White',
    'Austin, United States',
    500,  -- Starting tokens for testing
    0,    -- No messages yet
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    age = EXCLUDED.age,
    sex = EXCLUDED.sex,
    ethnicity = EXCLUDED.ethnicity,
    location = EXCLUDED.location,
    tokens_remaining = EXCLUDED.tokens_remaining,
    updated_at = NOW();

-- Get the user ID for subsequent operations
DO $$
DECLARE
    user_id_var UUID;
BEGIN
    SELECT id INTO user_id_var FROM users WHERE email = 'deeshop9821@gmail.com';
    
    -- Create user profile
    INSERT INTO user_profiles (
        user_id,
        memory_summary,
        last_memory_date,
        coach_style,
        onboarding_completed,
        created_at,
        updated_at
    ) VALUES (
        user_id_var,
        'New user - Sarah, 32-year-old female from Austin. Selected challenges: anxiety, depression, relationship issues, finding purpose.',
        NOW(),
        'supportive',  -- Default coach style
        true,         -- Profile setup completed
        NOW(),
        NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        memory_summary = EXCLUDED.memory_summary,
        coach_style = EXCLUDED.coach_style,
        onboarding_completed = EXCLUDED.onboarding_completed,
        updated_at = NOW();
    
    -- Add challenge selections (following current onboarding flow)
    -- First, remove any existing challenges
    DELETE FROM user_challenges WHERE user_id = user_id_var;
    
    -- Insert the selected challenges
    INSERT INTO user_challenges (user_id, challenge_type, selected_at) VALUES
    (user_id_var, 'anxiety', NOW()),
    (user_id_var, 'depression', NOW()),
    (user_id_var, 'relationship_issues', NOW()),
    (user_id_var, 'finding_purpose', NOW());
    
    RAISE NOTICE 'User Sarah created successfully with ID: %', user_id_var;
END $$;

-- Verify the user was created correctly
SELECT 'User verification:' as status;
SELECT 
    u.id,
    u.email,
    u.name,
    u.age,
    u.sex,
    u.ethnicity,
    u.location,
    u.tokens_remaining,
    u.created_at
FROM users u 
WHERE u.email = 'deeshop9821@gmail.com';

-- Verify user profile
SELECT 'Profile verification:' as status;
SELECT 
    up.user_id,
    up.memory_summary,
    up.coach_style,
    up.onboarding_completed,
    up.created_at
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.email = 'deeshop9821@gmail.com';

-- Verify challenge selections
SELECT 'Challenge verification:' as status;
SELECT 
    uc.user_id,
    uc.challenge_type,
    uc.selected_at
FROM user_challenges uc
JOIN users u ON uc.user_id = u.id
WHERE u.email = 'deeshop9821@gmail.com'
ORDER BY uc.challenge_type;

-- Summary report
SELECT 'SETUP COMPLETE - Test user ready!' as status;
SELECT 
    'Email: ' || u.email || 
    ', Name: ' || u.name || 
    ', Challenges: ' || COUNT(uc.challenge_type)::text ||
    ', Tokens: ' || u.tokens_remaining::text as summary
FROM users u
LEFT JOIN user_challenges uc ON u.id = uc.user_id
WHERE u.email = 'deeshop9821@gmail.com'
GROUP BY u.id, u.email, u.name, u.tokens_remaining;

-- Optional: Add some sample goals if your system supports them
-- (Uncomment if you have a goals table)
/*
INSERT INTO user_goals (
    user_id,
    goal_type,
    title,
    description,
    status,
    created_at
) 
SELECT 
    u.id,
    'mental_health',
    'Manage Anxiety Better',
    'Develop daily coping strategies for anxiety management',
    'active',
    NOW()
FROM users u 
WHERE u.email = 'deeshop9821@gmail.com'
ON CONFLICT DO NOTHING;
*/

-- Instructions for next steps
SELECT '
NEXT STEPS:
1. User is now created and ready for testing
2. You can run the test automation suite: node test-runner.js basic --verbose
3. Or test manually by logging in with deeshop9821@gmail.com
4. The user has 500 tokens and is set up with all required challenges

PROFILE SUMMARY:
- Email: deeshop9821@gmail.com
- Name: Sarah
- Age: 32, Female, White, Austin TX
- Challenges: Anxiety, Depression, Relationship Issues, Finding Purpose
- Tokens: 500
- Ready for testing!
' as instructions;
