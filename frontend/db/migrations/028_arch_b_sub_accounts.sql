-- Architecture B Phase 5: sub-account execution with SpendPermission-based
-- parent funding. Adds nullable columns; existing rows stay legacy (direct
-- CSW execution). New rows with sub_account_address populated route through
-- the sub-account path behind the ARCH_B_SUB_ACCOUNTS_ENABLED feature flag.
--
-- Semantics:
-- - sub_account_address: execution surface (the CSW whose UserOps are submitted).
--   When NULL, smart_wallet_address IS the execution surface (legacy direct CSW).
--   When non-NULL, smart_wallet_address still names the execution surface
--   (it is kept in sync with sub_account_address during provisioning, PR-B),
--   and parent_csw_address names the funding CSW whose balance backs spend.
-- - spend_permission_payload: EIP-712 SpendPermission struct (JSONB) signed by
--   the parent CSW. Replayed on each sub-account UserOp via the manager.
-- - spend_permission_signature: 0x-hex signature from a parent-CSW owner EOA
--   over the EIP-712 hash. Accepted by SpendPermissionManager.approveWithSignature.
-- - spend_permission_hash: cached EIP-712 hash (0x-hex) for dedupe / lookup.
-- - spend_allowance_wei / spend_period_seconds / spend_permission_end_at:
--   denormalized copies of the payload fields for indexable preflight.
-- - spend_permission_revoked_at: soft-revocation for the permission only.
--   Independent of the row-level revoked_at gate; either being set refuses.

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

-- Index for sub_account_address reverse lookup (resolve by execution address).
CREATE INDEX IF NOT EXISTS idx_ciec_sub_account_address
  ON public.command_issuer_execution_context(sub_account_address)
  WHERE sub_account_address IS NOT NULL;

-- Table already has RLS enabled in migration 027 with no permissive policies.
-- New columns inherit that posture: service role bypasses RLS; everyone else
-- is denied. No policy changes required.
