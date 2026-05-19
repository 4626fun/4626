-- Arch B sub-account columns (frontend/db/migrations/028) + provisioning_source (039).
-- Required for POST /api/arch-b/sub-account/baseapp/register (waitlist Base App connect).

ALTER TABLE public.command_issuer_execution_context
  ADD COLUMN IF NOT EXISTS sub_account_address         TEXT,
  ADD COLUMN IF NOT EXISTS parent_csw_address          TEXT,
  ADD COLUMN IF NOT EXISTS spend_permission_payload    JSONB,
  ADD COLUMN IF NOT EXISTS spend_permission_signature  TEXT,
  ADD COLUMN IF NOT EXISTS spend_permission_hash       TEXT,
  ADD COLUMN IF NOT EXISTS spend_allowance_wei         NUMERIC(78, 0),
  ADD COLUMN IF NOT EXISTS spend_period_seconds        INTEGER,
  ADD COLUMN IF NOT EXISTS spend_permission_end_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS spend_permission_revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ciec_sub_account_address
  ON public.command_issuer_execution_context(sub_account_address)
  WHERE sub_account_address IS NOT NULL;

ALTER TABLE public.command_issuer_execution_context
  ADD COLUMN IF NOT EXISTS provisioning_source TEXT
    CHECK (
      provisioning_source IS NULL
      OR provisioning_source IN ('arch_b_admin', 'baseapp_waitlist')
    );

CREATE INDEX IF NOT EXISTS command_issuer_execution_context_provisioning_source_idx
  ON public.command_issuer_execution_context (provisioning_source)
  WHERE provisioning_source IS NOT NULL;

COMMENT ON COLUMN public.command_issuer_execution_context.provisioning_source IS
  'Provisioning surface: arch_b_admin (spend-permission path) or baseapp_waitlist (waitlist Base App connect). NULL = legacy pre-039.';
