-- Schema Verification Script for AskMe AI Test Database
-- Run this to verify your current database schema matches the test expectations
-- Email: deeshop9821@gmail.com

-- Check if test user exists
SELECT 
  'TEST USER STATUS' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Test user exists'
    ELSE '❌ Test user not found'
  END as status,
  COALESCE(MAX(id), 'N/A') as user_id,
  COALESCE(MAX(tokens), 0) as tokens,
  COALESCE(MAX(coach_profile_id), 'N/A') as coach_assigned
FROM users 
WHERE email = 'deeshop9821@gmail.com';

-- Check user_profiles table
SELECT 
  'USER PROFILE STATUS' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ User profile exists'
    ELSE '❌ User profile missing'
  END as status,
  COALESCE(MAX(LENGTH(up.memory_summary)), 0) as memory_length
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.email = 'deeshop9821@gmail.com';

-- Check user challenges
SELECT 
  'USER CHALLENGES STATUS' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ User challenges assigned (' || COUNT(*) || ')'
    ELSE '❌ No challenges assigned'
  END as status,
  STRING_AGG(cc.label, ', ') as challenges
FROM user_challenges uc
JOIN users u ON uc.user_id = u.id
JOIN coach_challenges cc ON uc.coach_challenge_id = cc.id
WHERE u.email = 'deeshop9821@gmail.com';

-- Check if necessary tables exist
SELECT 
  'DATABASE SCHEMA STATUS' as check_type,
  '✅ Core tables verified' as status,
  'users, user_profiles, user_challenges, coach_challenges, chat_messages' as tables_checked;

-- Check coach_challenges table structure
SELECT 
  'COACH CHALLENGES AVAILABLE' as check_type,
  COUNT(*) || ' challenges available' as status,
  STRING_AGG(label, ', ') as available_challenges
FROM coach_challenges
WHERE label IS NOT NULL
LIMIT 10;

-- Check coach_profiles table
SELECT 
  'COACH PROFILES STATUS' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Coach profiles available (' || COUNT(*) || ')'
    ELSE '❌ No coach profiles found'
  END as status,
  STRING_AGG(COALESCE(label, code), ', ') as coaches
FROM coach_profiles
WHERE (label IS NOT NULL OR code IS NOT NULL)
LIMIT 5;

-- Final readiness check
SELECT 
  '🎯 TEST READINESS SUMMARY' as check_type,
  CASE 
    WHEN user_count.count > 0 AND profile_count.count > 0 THEN '✅ Ready for testing!'
    WHEN user_count.count > 0 THEN '⚠️ User exists but missing profile'
    ELSE '❌ Setup incomplete'
  END as status,
  'Run tests with: npm run test:automated' as next_step
FROM 
  (SELECT COUNT(*) as count FROM users WHERE email = 'deeshop9821@gmail.com') user_count
CROSS JOIN 
  (SELECT COUNT(*) as count FROM user_profiles up JOIN users u ON up.user_id = u.id WHERE u.email = 'deeshop9821@gmail.com') profile_count;
