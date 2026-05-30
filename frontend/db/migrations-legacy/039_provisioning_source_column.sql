-- Migration 039: provisioning_source on command_issuer_execution_context
--
-- Why
--   We are introducing a second provisioning surface for the
--   `command_issuer_execution_context` table: the waitlist Base App flow
--   (browser-driven sub-account creation via the Base Account SDK),
--   alongside the existing arch-b admin / agent-command flow
--   (server-driven, EIP-712 spend-permission). Both write the same row
--   shape but the waitlist flow leaves the spend_permission_* columns
--   NULL and is gated by a different feature flag.
--
--   We need to be able to tell which provisioning surface created /
--   most recently updated a row, so:
--     - operators can audit which path produced a row (and apply the
--       right diagnostic playbook)
--     - downstream code can choose behaviour by source (e.g. the
--       baseapp-waitlist source has no spend permission and should not
--       attempt to read one)
--
-- What this migration does
--   1. Adds nullable `provisioning_source TEXT` with a CHECK constraint
--      restricted to known values (`arch_b_admin`, `baseapp_waitlist`).
--      Existing rows stay NULL — application code treats NULL the same
--      as `arch_b_admin` for backward compatibility.
--   2. Adds a partial index on `provisioning_source` for analytics
--      (the column will only be populated for rows written after this
--      migration; the partial WHERE filter keeps the index small).
--
-- This migration does NOT:
--   - backfill existing rows (intentional; we don't want to silently
--     re-attribute legacy rows to either surface)
--   - require the column to be NOT NULL (legacy rows must keep working)
--
-- Rollback
--   DROP INDEX IF EXISTS public.command_issuer_execution_context_provisioning_source_idx;
--   ALTER TABLE public.command_issuer_execution_context DROP COLUMN IF EXISTS provisioning_source;

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
  'Which provisioning surface wrote / most recently updated this row. NULL = legacy row predating migration 039 (treated as arch_b_admin). One of: arch_b_admin (server-driven, agent-command flow with spend permission), baseapp_waitlist (browser-driven, waitlist Base App connect flow without spend permission v1).';
