-- ============================================================
-- Migration: Add severity-specific porn recovery goals
-- Created: 2026-02-06
-- Purpose:
--   1) Add severity column to coach_wellness_goals
--   2) Insert 16 severity-specific porn recovery goals (4 per level)
--   3) Backfill existing 8 porn goals as 'moderate' (general-purpose)
--   4) Add indexes and uniqueness constraint
--
-- Severity labels (matching user_challenge_assessments):
--   occasional    – "It shows up sometimes."
--   growing       – "It's becoming a pattern."
--   compulsive    – "I often struggle to stop."
--   overwhelming  – "It feels out of control."
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================


-- ============================================================
-- STEP 1: Add severity column to coach_wellness_goals
-- ============================================================

-- Add column if it does not exist.
-- Default NULL for backward compatibility: existing goals (wellness, fitness, etc.)
-- remain severity-agnostic. Only addiction/challenge-specific goals use severity.
-- NULL means "general / all severities" — shown when no severity filter is applied.
ALTER TABLE coach_wellness_goals
  ADD COLUMN IF NOT EXISTS severity TEXT;

-- Add check constraint (only if not already present).
-- We use a DO block because ALTER TABLE ADD CONSTRAINT IF NOT EXISTS is not standard PG.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_wellness_goals_severity'
      AND conrelid = 'coach_wellness_goals'::regclass
  ) THEN
    ALTER TABLE coach_wellness_goals
      ADD CONSTRAINT chk_wellness_goals_severity
      CHECK (severity IS NULL OR severity IN (
        'occasional', 'growing', 'compulsive', 'overwhelming'
      ));
  END IF;
END $$;

COMMENT ON COLUMN coach_wellness_goals.severity IS
  'Severity level this goal targets. NULL = general/all-severity. Values: occasional, growing, compulsive, overwhelming.';


-- ============================================================
-- STEP 2: Composite index for severity-aware queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wellness_goals_coach_challenge_severity
  ON coach_wellness_goals (coach_profile_id, challenge_id, severity, display_order);


-- ============================================================
-- STEP 3: Uniqueness constraint to prevent duplicate goals
-- ============================================================
-- Prevent inserting the same (coach, challenge, severity, label) twice.
-- Uses COALESCE so NULL severity is treated as '__all__' for uniqueness purposes.
-- Wrapped in DO block to handle case where duplicates already exist.
DO $$
BEGIN
  -- Try to create the unique index
  CREATE UNIQUE INDEX IF NOT EXISTS uq_wellness_goals_coach_challenge_sev_label
    ON coach_wellness_goals (
      coach_profile_id,
      COALESCE(challenge_id, '__none__'),
      COALESCE(severity, '__all__'),
      label
    );
  RAISE NOTICE '✅ Unique index created successfully';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '⚠️  Unique index not created: duplicate goals exist. This is safe if running migration multiple times.';
  WHEN duplicate_table THEN
    RAISE NOTICE '✅ Unique index already exists';
END $$;


-- ============================================================
-- STEP 4: Backfill existing 8 porn goals as NULL severity
--         (they are general-purpose, severity-agnostic)
-- ============================================================
-- Existing 8 goals already have severity = NULL (the default),
-- so no explicit backfill needed. This comment documents the decision:
-- They serve as fallback goals when no severity-specific goal exists.


-- ============================================================
-- STEP 5: Insert 16 severity-specific porn recovery goals
-- ============================================================
DO $$
DECLARE
  v_coach_id UUID;
  v_challenge_id TEXT;
BEGIN
  -- Look up porn_coach profile
  SELECT id INTO v_coach_id
  FROM coach_profiles
  WHERE code = 'porn_coach';

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'porn_coach profile not found. Run the porn coach migration first.';
  END IF;

  -- Look up porn challenge_id string
  SELECT challenge_id INTO v_challenge_id
  FROM coach_challenges
  WHERE label = 'Pornography Addiction'
    AND is_active = true
  LIMIT 1;

  IF v_challenge_id IS NULL THEN
    RAISE EXCEPTION 'Active "Pornography Addiction" challenge not found.';
  END IF;

  -- ========================================
  -- OCCASIONAL (level 1): Build awareness + strengthen identity + prevent drift
  -- "It shows up sometimes" — focus on awareness, not lockdown
  -- ========================================

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'occasional',
    'Understand my pattern (30 days)',
    'Log urges/slips in under 10 seconds and identify your top triggers + top risk window.',
    1, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'occasional',
    'Train the pause response',
    'Practice a short daily mindfulness/grounding routine so urges are felt without automatic action.',
    2, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'occasional',
    'Rebuild healthy dopamine',
    'Re-engage 2 hobbies/interests and schedule them into your risk windows so boredom stops being a trigger.',
    3, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'occasional',
    'Improve my baseline (sleep/mood/energy)',
    'Build simple self-care habits that reduce vulnerability: sleep routine, movement, hydration, sunlight, social contact.',
    4, true
  );

  -- ========================================
  -- GROWING (level 2): Interrupt loop + reduce frequency + stabilize nights
  -- "It's becoming a pattern" — interrupt the loop, build competing habits
  -- ========================================

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'growing',
    'Cut frequency by 50%',
    'Reduce porn sessions/days by half over 30 days using structured replacement + tracking.',
    1, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'growing',
    'Win the late-night window',
    'Build a "risk-window plan" (10pm–1am or your window) so the pattern stops repeating.',
    2, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'growing',
    'Stop the urge escalation',
    'Use a consistent interruption protocol when urges appear, before searching/scrolling begins.',
    3, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'growing',
    'Lower my trigger load',
    'Identify top 2 trigger sources (social media, browsing, loneliness) and create boundaries that reduce exposure.',
    4, true
  );

  -- ========================================
  -- COMPULSIVE (level 3): Containment + stop binges + strengthen guardrails + rebuild self-care
  -- "I often struggle to stop" — reduce harm, build resilience, break shame cycles
  -- ========================================

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'compulsive',
    'Lock down access for 30 days',
    'Set meaningful friction so porn isn''t reachable in seconds. Focus is consistency, not perfect willpower.',
    1, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'compulsive',
    'No "second session" after a slip',
    'The goal is not perfection; it''s stopping the spiral. Close quickly, reset, repair, and return to plan.',
    2, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'compulsive',
    'Complete 1–2 recovery reps daily',
    'Build the habit of showing up daily with small actions that strengthen control and reduce relapse probability.',
    3, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'compulsive',
    'Reduce vulnerability (sleep/stress/loneliness)',
    'A realistic baseline plan focused on the biggest drivers: sleep, stress regulation, and connection.',
    4, true
  );

  -- ========================================
  -- OVERWHELMING (level 4): Stabilize first, fewer decisions, immediate safety and support
  -- "It feels out of control" — maximize safety, simplify plan, offer immediate tools
  -- ========================================

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'overwhelming',
    'Get stable this week',
    'A short stabilization period: fewer choices, strong supports, focus on safety and consistency.',
    1, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'overwhelming',
    'No private device use when activated',
    'When urges spike, you use a containment rule: change environment, reduce privacy, reduce access.',
    2, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'overwhelming',
    'Use emergency protocol for high urges',
    'When intensity is high, you don''t "think"; you follow a protocol: Support Now + environment shift + one repair action.',
    3, true
  );

  INSERT INTO coach_wellness_goals (goal_id, coach_profile_id, challenge_id, severity, label, description, display_order, is_active)
  VALUES (gen_random_uuid(), v_coach_id, v_challenge_id, 'overwhelming',
    'Recover fast after a slip',
    'Prevent shame spiral by executing a repair plan immediately after any slip.',
    4, true
  );

  RAISE NOTICE '✅ Inserted 16 severity-specific porn recovery goals (4 per severity level)';
END $$;


-- ============================================================
-- VERIFICATION: Show all porn goals grouped by severity
-- ============================================================
SELECT
  COALESCE(g.severity, '(general)') AS severity,
  g.display_order,
  g.label,
  LEFT(g.description, 80) || '...' AS description_preview,
  g.is_active,
  p.code AS coach_code,
  g.challenge_id
FROM coach_wellness_goals g
JOIN coach_profiles p ON g.coach_profile_id = p.id
WHERE p.code = 'porn_coach'
ORDER BY
  CASE g.severity
    WHEN 'occasional'   THEN 1
    WHEN 'growing'      THEN 2
    WHEN 'compulsive'   THEN 3
    WHEN 'overwhelming' THEN 4
    ELSE 0  -- general/NULL goals first
  END,
  g.display_order;
