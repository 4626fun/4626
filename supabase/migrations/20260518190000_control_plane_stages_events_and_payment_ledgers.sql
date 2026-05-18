-- Migration: promote control-plane lifecycle truth and payment event ledger.

BEGIN;

ALTER TABLE public.control_plane_operations
  DROP CONSTRAINT IF EXISTS control_plane_operations_status_check;

ALTER TABLE public.control_plane_operations
  ADD CONSTRAINT control_plane_operations_status_check
  CHECK (
    status IN (
      'requested',
      'queued',
      'running',
      'blocked',
      'retrying',
      'manual_review',
      'succeeded',
      'failed',
      'cancelled',
      'expired'
    )
  );

ALTER TABLE public.control_plane_operations
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS lock_scope TEXT,
  ADD COLUMN IF NOT EXISTS lock_key TEXT,
  ADD COLUMN IF NOT EXISTS schema_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS input_hash TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT;

CREATE INDEX IF NOT EXISTS control_plane_operations_scope_idx
  ON public.control_plane_operations (scope_type, scope_id, created_at DESC);

DROP INDEX IF EXISTS control_plane_operations_idempotency_idx;
CREATE UNIQUE INDEX IF NOT EXISTS control_plane_operations_idempotency_scope_uidx
  ON public.control_plane_operations (operation_kind, scope_type, scope_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS control_plane_operations_active_lock_uidx
  ON public.control_plane_operations (operation_kind, lock_scope, lock_key)
  WHERE lock_scope IS NOT NULL
    AND lock_key IS NOT NULL
    AND status IN ('requested', 'queued', 'running', 'blocked', 'retrying', 'manual_review');

CREATE TABLE IF NOT EXISTS public.control_plane_stages (
  id BIGSERIAL PRIMARY KEY,
  stage_id TEXT NOT NULL UNIQUE,
  operation_id TEXT NOT NULL REFERENCES public.control_plane_operations(operation_id) ON DELETE CASCADE,
  stage_kind TEXT NOT NULL CHECK (stage_kind ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  status TEXT NOT NULL CHECK (
    status IN (
      'requested',
      'queued',
      'running',
      'blocked',
      'retrying',
      'manual_review',
      'succeeded',
      'failed',
      'cancelled',
      'expired'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS control_plane_stages_operation_idx
  ON public.control_plane_stages (operation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS control_plane_stages_status_idx
  ON public.control_plane_stages (status, stage_kind, created_at DESC);

ALTER TABLE public.control_plane_stages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'control_plane_stages'
      AND policyname = 'control_plane_stages_deny_all'
  ) THEN
    CREATE POLICY control_plane_stages_deny_all
      ON public.control_plane_stages
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.control_plane_events (
  id BIGSERIAL PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES public.control_plane_operations(operation_id) ON DELETE CASCADE,
  stage_id TEXT REFERENCES public.control_plane_stages(stage_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  message TEXT NOT NULL DEFAULT '',
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS control_plane_events_operation_idx
  ON public.control_plane_events (operation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS control_plane_events_stage_idx
  ON public.control_plane_events (stage_id, created_at DESC)
  WHERE stage_id IS NOT NULL;

ALTER TABLE public.control_plane_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'control_plane_events'
      AND policyname = 'control_plane_events_deny_all'
  ) THEN
    CREATE POLICY control_plane_events_deny_all
      ON public.control_plane_events
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

ALTER TABLE public.keeper_jobs
  ADD COLUMN IF NOT EXISTS operation_id TEXT REFERENCES public.control_plane_operations(operation_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id TEXT REFERENCES public.control_plane_stages(stage_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS keeper_jobs_operation_idx
  ON public.keeper_jobs (operation_id, created_at DESC)
  WHERE operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS keeper_jobs_stage_idx
  ON public.keeper_jobs (stage_id, created_at DESC)
  WHERE stage_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN (
      'quoted',
      'payment_pending',
      'paid',
      'provisioning_queued',
      'provisioning_running',
      'manual_review',
      'completed',
      'failed',
      'refunded',
      'cancelled',
      'expired'
    )
  ),
  amount NUMERIC(39, 0) NOT NULL,
  currency TEXT NOT NULL,
  policy_version TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_orders_status_idx
  ON public.payment_orders (status, created_at DESC);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_orders'
      AND policyname = 'payment_orders_deny_all'
  ) THEN
    CREATE POLICY payment_orders_deny_all
      ON public.payment_orders
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.payment_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  order_id TEXT REFERENCES public.payment_orders(order_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  amount NUMERIC(39, 0),
  currency TEXT,
  payload_hash TEXT,
  payload_json JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_event_uidx
  ON public.payment_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS payment_events_order_idx
  ON public.payment_events (order_id, received_at DESC)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_events'
      AND policyname = 'payment_events_deny_all'
  ) THEN
    CREATE POLICY payment_events_deny_all
      ON public.payment_events
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.payment_rail_attempts (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT REFERENCES public.payment_orders(order_id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  attempt_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'retry')),
  error_code TEXT,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_rail_attempts_order_idx
  ON public.payment_rail_attempts (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.payment_rail_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_rail_attempts'
      AND policyname = 'payment_rail_attempts_deny_all'
  ) THEN
    CREATE POLICY payment_rail_attempts_deny_all
      ON public.payment_rail_attempts
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.keepr_workflow_checkpoints (
  workflow TEXT NOT NULL,
  checkpoint_key TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json JSONB,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workflow, checkpoint_key)
);

ALTER TABLE public.keepr_workflow_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'keepr_workflow_checkpoints'
      AND policyname = 'keepr_workflow_checkpoints_deny_all'
  ) THEN
    CREATE POLICY keepr_workflow_checkpoints_deny_all
      ON public.keepr_workflow_checkpoints
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

COMMIT;
