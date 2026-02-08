-- Migration: Add porn recovery goals to coach_wellness_goals table
-- Date: 2026-02-06
-- Description: Insert 8 core porn recovery goals associated with porn_coach

DO $$
DECLARE
  porn_coach_id UUID;
  porn_challenge_id TEXT;
BEGIN
  -- Get the porn_coach profile ID
  SELECT id INTO porn_coach_id 
  FROM coach_profiles 
  WHERE code = 'porn_coach';
  
  -- Get the porn challenge ID
  SELECT challenge_id INTO porn_challenge_id
  FROM coach_challenges
  WHERE label = 'Pornography Addiction'
  AND is_active = true
  LIMIT 1;
  
  IF porn_coach_id IS NULL THEN
    RAISE EXCEPTION 'porn_coach profile not found';
  END IF;
  
  IF porn_challenge_id IS NULL THEN
    RAISE EXCEPTION 'Porn challenge not found';
  END IF;
  
  -- Insert Core Track Goals
  
  -- Goal 1: Reduce exposure to triggers
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Eliminate easy access to porn on my devices',
    'Most users relapse due to frictionless access, not desire alone. Success means: No unfiltered browsers, DNS/device-level blocking active, phone not used alone late at night.',
    1,
    true
  );
  
  -- Goal 2: Break late-night relapse pattern
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Get through nights without porn',
    'Forums overwhelmingly cite 10pm–1am as the danger zone. Success means: Devices out of bedroom, fixed wind-down routine, lights-out anchor time.',
    2,
    true
  );
  
  -- Goal 3: Increase time between urges and action
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Create a pause between urge and behavior',
    'Recovery starts when urges stop being automatic. Success means: Use a tool when urge hits, wait 10 minutes before acting, track urges resisted.',
    3,
    true
  );
  
  -- Goal 4: Reduce binge cycles after slips
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'If I slip, I recover instead of spiraling',
    'Shame → binge is a dominant pattern in addiction forums. Success means: No second session after a slip, use a recovery protocol immediately, resume plan same day.',
    4,
    true
  );
  
  -- Goal 5: Decrease frequency (harm reduction)
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Reduce porn use from X times/week to Y',
    'Many users cannot jump straight to abstinence. Success means: Weekly count reduction, longer streaks even if imperfect, honest tracking.',
    5,
    true
  );
  
  -- Goal 6: Learn to regulate stress without porn
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Handle stress without escaping into porn',
    'Porn is often stress regulation, not sex. Success means: Use breathing/grounding tools, identify stress triggers, one alternative response per day.',
    6,
    true
  );
  
  -- Goal 7: Reduce compulsive fantasy / mental rehearsal
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Interrupt porn fantasies before they spiral',
    'Many users relapse hours before opening a site. Success means: Catch fantasy early, shift attention deliberately, use short mental reset tools.',
    7,
    true
  );
  
  -- Goal 8: Build tolerance for boredom and loneliness
  INSERT INTO coach_wellness_goals (
    goal_id,
    coach_profile_id,
    challenge_id,
    label,
    description,
    display_order,
    is_active
  ) VALUES (
    gen_random_uuid(),
    porn_coach_id,
    porn_challenge_id,
    'Sit with boredom or loneliness without escaping',
    'These two emotions are the top precursors in recovery threads. Success means: Delay distraction, replace with low-dopamine activity, track time spent staying present.',
    8,
    true
  );
  
  RAISE NOTICE 'Successfully inserted 8 porn recovery goals for porn_coach';
END $$;

-- Verification query
SELECT 
  g.label,
  g.display_order,
  c.label as challenge_label,
  p.code as coach_code
FROM coach_wellness_goals g
JOIN coach_profiles p ON g.coach_profile_id = p.id
LEFT JOIN coach_challenges c ON g.challenge_id = c.challenge_id
WHERE p.code = 'porn_coach'
ORDER BY g.display_order;
