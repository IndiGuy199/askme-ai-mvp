-- Migration: slip_events table
-- Stores user-reported slips for pattern tracking and self-compassion support

CREATE TABLE IF NOT EXISTS public.slip_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slipped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    trigger_label   TEXT,       -- e.g. 'stress', 'boredom', 'loneliness', 'late night'
    urge_level      INTEGER     CHECK (urge_level BETWEEN 1 AND 10),
    notes           TEXT,
    recovery_note   TEXT,       -- optional: "what will you do differently?"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slip_events_user_id ON public.slip_events (user_id);
CREATE INDEX IF NOT EXISTS idx_slip_events_slipped_at ON public.slip_events (user_id, slipped_at DESC);

-- RLS: users access only their own slips
ALTER TABLE public.slip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own slips"
    ON public.slip_events
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
