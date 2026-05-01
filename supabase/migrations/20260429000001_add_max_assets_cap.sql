-- ============================================================================
-- workspace_strategy_targets.max_assets_cap
--
-- Operator-facing mirror of the on-chain `strategyMaxAssets[strategy]` cap on
-- `CreatorOVault`. The cap is enforced on-chain (see
-- contracts/vault/CreatorOVault.sol#strategyMaxAssets); this column lets the
-- admin/operator UI display the intended cap alongside the on-chain value so
-- operators can spot drift and confirm classification.
--
-- Stored as NUMERIC(78, 0) — wide enough for uint256 — and nullable. NULL means
-- "no cap is configured in Supabase yet"; the runbook treats that the same as
-- "uncapped on-chain" and the UI must surface the discrepancy.
-- ============================================================================

ALTER TABLE workspace_strategy_targets
  ADD COLUMN IF NOT EXISTS max_assets_cap NUMERIC(78, 0) NULL;

COMMENT ON COLUMN workspace_strategy_targets.max_assets_cap IS
  'Operator-intended value for on-chain strategyMaxAssets[strategy]. NUMERIC(78,0) = uint256. NULL = unset (treated as uncapped).';
