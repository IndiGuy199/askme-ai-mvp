-- ============================================================
-- Apply missing baseline and event tracking tables
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1) Goal baseline snapshots (captured when goal becomes active or is swapped)
CREATE TABLE IF NOT EXISTS user_goal_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_goal_id UUID REFERENCES user_wellness_goals(id) ON DELETE SET NULL,
  goal_slot INT NOT NULL CHECK (goal_slot IN (1, 2)),

  -- Snapshot fields (fast capture, all optional)
  slip_freq_30d_bucket TEXT CHECK (slip_freq_30d_bucket IN ('none', '1_2', 'weekly', 'most_days', 'daily')),
  longest_streak_90d_bucket TEXT CHECK (longest_streak_90d_bucket IN ('lt_3d', '3_7d', '1_3w', '1m_plus')),
  risk_window TEXT CHECK (risk_window IN ('morning', 'afternoon', 'evening', 'late_night')),
  top_trigger TEXT CHECK (top_trigger IN ('boredom', 'stress', 'loneliness', 'anxiety', 'conflict', 'other')),
  confidence_0_10 INT CHECK (confidence_0_10 BETWEEN 0 AND 10),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ugb_user_created ON user_goal_baselines(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugb_user_goal ON user_goal_baselines(user_id, user_goal_id);


-- 2) Goal swap/event history
CREATE TABLE IF NOT EXISTS user_goal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('add', 'swap', 'remove', 'baseline_update')),
  goal_slot INT CHECK (goal_slot IN (1, 2)),
  from_user_goal_id UUID,
  to_user_goal_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uge_user_created ON user_goal_events(user_id, created_at DESC);


-- 3) Action baseline snapshots (captured when action is added/swapped)
CREATE TABLE IF NOT EXISTS user_action_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_goal_id UUID REFERENCES user_wellness_goals(id) ON DELETE SET NULL,
  action_id UUID REFERENCES action_plans(id) ON DELETE SET NULL,

  expected_minutes INT CHECK (expected_minutes BETWEEN 1 AND 240),
  difficulty_1_5 INT CHECK (difficulty_1_5 BETWEEN 1 AND 5),
  target_per_week INT CHECK (target_per_week BETWEEN 1 AND 21),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uab_user_created ON user_action_baselines(user_id, created_at DESC);


-- 4) Action swap/event history
CREATE TABLE IF NOT EXISTS user_action_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('add', 'swap', 'remove', 'baseline_update')),
  user_goal_id UUID,
  from_action_id UUID,
  to_action_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uae_user_created ON user_action_events(user_id, created_at DESC);


-- 5) Enrich action_completions with optional high-signal fields (if the table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'action_completions') THEN
    ALTER TABLE action_completions
      ADD COLUMN IF NOT EXISTS urge_before_0_10 INT CHECK (urge_before_0_10 BETWEEN 0 AND 10),
      ADD COLUMN IF NOT EXISTS urge_after_0_10 INT CHECK (urge_after_0_10 BETWEEN 0 AND 10),
      ADD COLUMN IF NOT EXISTS context TEXT CHECK (context IN ('bed', 'bathroom', 'couch', 'desk', 'car', 'outside', 'other'));
    
    CREATE INDEX IF NOT EXISTS idx_ac_user_created ON action_completions(user_id, created_at DESC);
  END IF;
END $$;


-- ============================================================
-- RLS (Row Level Security) for baseline and event tables
-- ============================================================

ALTER TABLE user_goal_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_events ENABLE ROW LEVEL SECURITY;

-- user_goal_baselines: users can manage their own
DROP POLICY IF EXISTS "ugb_own" ON user_goal_baselines;
CREATE POLICY "ugb_own" ON user_goal_baselines
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE email = auth.email())
  );

-- user_goal_events: users can manage their own
DROP POLICY IF EXISTS "uge_own" ON user_goal_events;
CREATE POLICY "uge_own" ON user_goal_events
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE email = auth.email())
  );

-- user_action_baselines: users can manage their own
DROP POLICY IF EXISTS "uab_own" ON user_action_baselines;
CREATE POLICY "uab_own" ON user_action_baselines
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE email = auth.email())
  );

-- user_action_events: users can manage their own
DROP POLICY IF EXISTS "uae_own" ON user_action_events;
CREATE POLICY "uae_own" ON user_action_events
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE email = auth.email())
  );
