-- Verify porn recovery goals were inserted

-- 1. Check if porn_coach profile exists
SELECT 'porn_coach profile:' as check_type, id, code, label
FROM coach_profiles 
WHERE code = 'porn_coach';

-- 2. Check porn challenge
SELECT 'porn challenge:' as check_type, challenge_id, label, coach_profile_id
FROM coach_challenges 
WHERE label = 'Pornography Addiction' AND is_active = true;

-- 3. Check porn recovery goals in coach_wellness_goals
SELECT 'coach_wellness_goals:' as check_type, 
  g.goal_id, 
  g.label, 
  g.challenge_id,
  g.coach_profile_id,
  g.display_order,
  g.is_active
FROM coach_wellness_goals g
JOIN coach_profiles p ON g.coach_profile_id = p.id
WHERE p.code = 'porn_coach'
ORDER BY g.display_order;

-- 4. Check user rdee199@gmail.com's challenges
SELECT 'user challenges:' as check_type,
  uc.id as user_challenge_id,
  uc.user_id,
  uc.coach_challenge_id,
  cc.challenge_id,
  cc.label as challenge_label,
  cc.coach_profile_id
FROM user_challenges uc
JOIN coach_challenges cc ON uc.coach_challenge_id = cc.id
JOIN users u ON uc.user_id = u.id
WHERE u.email = 'rdee199@gmail.com';

-- 5. Compare: What coach_profile_id and challenge_id should be fetched?
SELECT 
  'Expected fetch params:' as check_type,
  cc.coach_profile_id,
  cc.challenge_id
FROM user_challenges uc
JOIN coach_challenges cc ON uc.coach_challenge_id = cc.id
JOIN users u ON uc.user_id = u.id
WHERE u.email = 'rdee199@gmail.com';
