-- Migration: Add severity assessment tracking tables
-- Created: 2026-02-06
-- Purpose:
--   1) user_challenge_assessments  – append-only history of severity assessments
--   2) user_challenge_latest_assessment – one-row-per-(user, challenge) snapshot for fast reads
--   3) Trigger to keep the latest table in sync automatically
--   4) RLS policies following existing auth.email() pattern
--
-- Severity levels (matches existing onboarding UI):
--   1 = occasional  – "It shows up sometimes."
--   2 = growing      – "It's becoming a pattern."
--   3 = compulsive   – "I often struggle to stop."
--   4 = overwhelming  – "It feels out of control."
--
-- Assessment sources:
--   onboarding      – initial setup
--   self_checkin    – user-initiated periodic reassessment
--   system_inferred – app-derived signal (low confidence, requires confirmation)
--   coach_prompt    – triggered by coach interaction

-- ============================================================
-- TABLE 1: user_challenge_assessments (append-only history)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_challenge_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Which challenge (FK to coach_challenges.id, the same FK used by user_challenges)
    coach_challenge_id UUID NOT NULL REFERENCES coach_challenges(id) ON DELETE CASCADE,

    -- When
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- How the assessment was collected
    assessment_source TEXT NOT NULL DEFAULT 'onboarding'
        CHECK (assessment_source IN (
            'onboarding', 'self_checkin', 'system_inferred', 'coach_prompt'
        )),

    -- Severity: integer level 1-4 with human-readable label
    severity_level SMALLINT NOT NULL CHECK (severity_level BETWEEN 1 AND 4),
    severity_label TEXT NOT NULL
        CHECK (severity_label IN (
            'occasional', 'growing', 'compulsive', 'overwhelming'
        )),

    -- Confidence (0.0 to 1.0). NULL = not applicable (user-reported is implicitly 1.0)
    severity_confidence NUMERIC(3,2)
        CHECK (severity_confidence IS NULL OR (severity_confidence >= 0 AND severity_confidence <= 1)),

    -- Timeframe the assessment covers (default 30 days)
    timeframe_days INT NOT NULL DEFAULT 30
        CHECK (timeframe_days IN (30, 90)),

    -- Schema version so we can evolve criteria without breaking history
    criteria_version TEXT NOT NULL DEFAULT 'v1',

    -- Free-form notes (kept short)
    notes TEXT,

    -- Structured signal data (frequency band, binge count, relapse flag, etc.)
    signals_json JSONB,

    -- Whether the user directly reported this (true) or it was system-inferred (false)
    is_user_reported BOOLEAN NOT NULL DEFAULT true
);

-- Comments
COMMENT ON TABLE user_challenge_assessments IS 'Append-only history of severity assessments per user per challenge. Never overwrite; always insert new rows.';
COMMENT ON COLUMN user_challenge_assessments.severity_level IS '1=occasional, 2=growing, 3=compulsive, 4=overwhelming';
COMMENT ON COLUMN user_challenge_assessments.signals_json IS 'Optional structured data: { frequency_band, binge_count_band, relapse_flag, time_of_day_risk, action_completion_rate }';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_user_challenge_created
    ON user_challenge_assessments (user_id, coach_challenge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessments_user_created
    ON user_challenge_assessments (user_id, created_at DESC);


-- ============================================================
-- TABLE 2: user_challenge_latest_assessment (fast snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_challenge_latest_assessment (
    -- Composite PK: one row per (user, challenge)
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_challenge_id UUID NOT NULL REFERENCES coach_challenges(id) ON DELETE CASCADE,

    -- Points back to the full assessment row
    latest_assessment_id UUID NOT NULL REFERENCES user_challenge_assessments(id) ON DELETE CASCADE,

    -- Denormalized for fast reads
    severity_level SMALLINT NOT NULL CHECK (severity_level BETWEEN 1 AND 4),
    severity_label TEXT NOT NULL
        CHECK (severity_label IN (
            'occasional', 'growing', 'compulsive', 'overwhelming'
        )),
    severity_confidence NUMERIC(3,2),
    timeframe_days INT NOT NULL DEFAULT 30,

    -- Marks which challenge is the user's primary track
    is_primary BOOLEAN NOT NULL DEFAULT false,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, coach_challenge_id)
);

COMMENT ON TABLE user_challenge_latest_assessment IS 'One row per (user, challenge) with denormalized latest severity. Updated automatically via trigger.';

-- Index for dashboard: quickly find user''s primary challenge
CREATE INDEX IF NOT EXISTS idx_latest_assessment_user_primary
    ON user_challenge_latest_assessment (user_id, is_primary DESC);


-- ============================================================
-- TRIGGER FUNCTION: sync latest assessment on insert
-- ============================================================
CREATE OR REPLACE FUNCTION sync_latest_assessment()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_challenge_latest_assessment (
        user_id,
        coach_challenge_id,
        latest_assessment_id,
        severity_level,
        severity_label,
        severity_confidence,
        timeframe_days,
        updated_at
    ) VALUES (
        NEW.user_id,
        NEW.coach_challenge_id,
        NEW.id,
        NEW.severity_level,
        NEW.severity_label,
        NEW.severity_confidence,
        NEW.timeframe_days,
        now()
    )
    ON CONFLICT (user_id, coach_challenge_id)
    DO UPDATE SET
        latest_assessment_id = EXCLUDED.latest_assessment_id,
        severity_level        = EXCLUDED.severity_level,
        severity_label        = EXCLUDED.severity_label,
        severity_confidence   = EXCLUDED.severity_confidence,
        timeframe_days        = EXCLUDED.timeframe_days,
        updated_at            = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_latest_assessment() IS 'Upserts user_challenge_latest_assessment whenever a new assessment row is inserted. Concurrency-safe via ON CONFLICT.';

-- Trigger fires AFTER INSERT only (append-only table)
CREATE TRIGGER trg_sync_latest_assessment
    AFTER INSERT ON user_challenge_assessments
    FOR EACH ROW
    EXECUTE FUNCTION sync_latest_assessment();


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- --- user_challenge_assessments ---
ALTER TABLE user_challenge_assessments ENABLE ROW LEVEL SECURITY;

-- SELECT own rows
CREATE POLICY "Users can view their own assessments"
    ON user_challenge_assessments
    FOR SELECT
    USING (
        user_id IN (SELECT id FROM users WHERE email = auth.email())
    );

-- INSERT own rows only
CREATE POLICY "Users can insert their own assessments"
    ON user_challenge_assessments
    FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM users WHERE email = auth.email())
    );

-- No UPDATE policy → historical rows are immutable
-- No DELETE policy → history is preserved

-- --- user_challenge_latest_assessment ---
ALTER TABLE user_challenge_latest_assessment ENABLE ROW LEVEL SECURITY;

-- SELECT own rows
CREATE POLICY "Users can view their own latest assessment"
    ON user_challenge_latest_assessment
    FOR SELECT
    USING (
        user_id IN (SELECT id FROM users WHERE email = auth.email())
    );

-- INSERT/UPDATE only via trigger (SECURITY DEFINER function runs as owner).
-- Authenticated users cannot directly write to this table.
-- Service role bypasses RLS and can write if needed (e.g., admin tools).

-- No INSERT, UPDATE, or DELETE policies for end users on the latest table.
-- The SECURITY DEFINER trigger function handles all writes.


-- ============================================================
-- HELPER: Mark one challenge as primary for a user
-- ============================================================
CREATE OR REPLACE FUNCTION set_primary_challenge(
    p_user_id UUID,
    p_coach_challenge_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Clear existing primary
    UPDATE user_challenge_latest_assessment
    SET is_primary = false
    WHERE user_id = p_user_id AND is_primary = true;

    -- Set new primary
    UPDATE user_challenge_latest_assessment
    SET is_primary = true, updated_at = now()
    WHERE user_id = p_user_id AND coach_challenge_id = p_coach_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_primary_challenge(UUID, UUID) IS 'Sets one challenge as the primary track for a user. Clears any previous primary flag first.';
