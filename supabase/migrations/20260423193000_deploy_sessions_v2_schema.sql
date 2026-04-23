-- Deploy sessions v2 canonical workflow fields.
-- This migration intentionally keeps the existing `public.deploys` table and
-- upgrades it in-place to the canonical orchestration model.

BEGIN;

ALTER TABLE IF EXISTS public.deploys
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS current_stage TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_run_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_owner TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS last_failure_stage TEXT,
  ADD COLUMN IF NOT EXISTS artifacts JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS deploys_state_idx ON public.deploys (state);
CREATE INDEX IF NOT EXISTS deploys_current_stage_idx ON public.deploys (current_stage);
CREATE INDEX IF NOT EXISTS deploys_next_run_after_idx ON public.deploys (next_run_after);
CREATE INDEX IF NOT EXISTS deploys_lock_expires_idx ON public.deploys (lock_expires_at);

UPDATE public.deploys
SET
  current_stage = COALESCE(NULLIF(current_stage, ''), step),
  state = COALESCE(
    NULLIF(state, ''),
    CASE
      WHEN step = 'completed' THEN 'completed'
      WHEN step = 'cancelled' THEN 'cancelled'
      WHEN step = 'failed' THEN 'failed'
      WHEN step LIKE '%_sent' OR step = 'created' THEN 'running'
      ELSE 'pending'
    END
  )
WHERE current_stage IS NULL
   OR current_stage = ''
   OR state IS NULL
   OR state = '';

COMMIT;
