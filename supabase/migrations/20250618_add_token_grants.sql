-- Migration: token_grants table + welcome token flag on users
-- Provides idempotent guard for one-time token allocations.
-- Profile completion uses welcome_tokens_granted_at on the users row
-- (single source of truth, atomic UPDATE WHERE ×IS NULL).
-- token_grants table is kept for future grant types.

-- 1. Store the idempotency flag directly on the users row
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_tokens_granted_at TIMESTAMPTZ NULL;

-- 2. Token grants ledger (for future grant types)
CREATE TABLE IF NOT EXISTS public.token_grants (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    grant_type  TEXT        NOT NULL,
    tokens      INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_token_grants_user_type
    ON public.token_grants (user_id, grant_type);

ALTER TABLE public.token_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own grants"
    ON public.token_grants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own grants"
    ON public.token_grants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Atomic profile-completion token grant
--    Returns TRUE when the grant was applied, FALSE when already granted.
CREATE OR REPLACE FUNCTION public.grant_profile_tokens(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.users
  SET
    tokens                    = COALESCE(tokens, 0) + 5000,
    welcome_tokens_granted_at = now()
  WHERE id = uid
    AND welcome_tokens_granted_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- 4. Generic increment helper (used by other callsites if needed)
CREATE OR REPLACE FUNCTION public.increment_tokens(uid UUID, amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users SET tokens = tokens + amount WHERE id = uid;
END;
$$;
