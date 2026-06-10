-- Migration 048: control-plane operation tracking for lifecycle mutations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.control_plane_operations (
  id BIGSERIAL PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  operation_kind TEXT NOT NULL CHECK (operation_kind ~ '^[a-z][a-z0-9_:-]{2,63}$'),
  vault_address TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  requested_by TEXT,
  idempotency_key TEXT,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS control_plane_operations_vault_idx
  ON public.control_plane_operations (LOWER(vault_address), created_at DESC)
  WHERE vault_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS control_plane_operations_status_idx
  ON public.control_plane_operations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS control_plane_operations_kind_idx
  ON public.control_plane_operations (operation_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS control_plane_operations_idempotency_idx
  ON public.control_plane_operations (operation_kind, idempotency_key, created_at DESC)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.control_plane_operations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'control_plane_operations'
      AND policyname = 'control_plane_operations_deny_all'
  ) THEN
    CREATE POLICY control_plane_operations_deny_all
      ON public.control_plane_operations
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE public.control_plane_operations IS
  'Audit timeline for 4626 control-plane operations (provision, maintenance, queue action, settlement).';

COMMIT;

