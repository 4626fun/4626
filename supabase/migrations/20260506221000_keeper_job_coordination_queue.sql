CREATE TABLE IF NOT EXISTS public.keeper_jobs (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.:-]{1,79}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'succeeded', 'failed', 'retry')),
  priority INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  source TEXT NOT NULL DEFAULT 'internal',
  dedupe_key TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS keeper_jobs_active_dedupe_idx
  ON public.keeper_jobs (dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('pending', 'claimed', 'retry');

CREATE INDEX IF NOT EXISTS keeper_jobs_due_idx
  ON public.keeper_jobs (status, run_at, priority DESC, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS keeper_jobs_claim_expiry_idx
  ON public.keeper_jobs (claim_expires_at)
  WHERE status = 'claimed';

CREATE INDEX IF NOT EXISTS keeper_jobs_kind_status_idx
  ON public.keeper_jobs (kind, status, created_at DESC);

ALTER TABLE public.keeper_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest" ON public.keeper_jobs;
CREATE POLICY "deny_public_rest"
  ON public.keeper_jobs
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
