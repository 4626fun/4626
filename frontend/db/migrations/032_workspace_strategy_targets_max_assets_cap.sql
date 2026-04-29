-- ============================================================================
-- workspace_strategy_targets.max_assets_cap
--
-- Operator-facing mirror of the on-chain `strategyMaxAssets[strategy]` cap on
-- `CreatorOVault`. See docs/governance/strategy-cap-runbook.md for the rule:
-- the on-chain value is authoritative; this column lets the operator UI display
-- the intended cap so drift between the two surfaces is visible.
--
-- NUMERIC(78, 0) is wide enough for uint256 and nullable: NULL means
-- "no cap configured in Supabase yet" (treated as uncapped from the UI's
-- perspective; the on-chain value is still authoritative).
-- ============================================================================

ALTER TABLE public.workspace_strategy_targets
  ADD COLUMN IF NOT EXISTS max_assets_cap NUMERIC(78, 0) NULL;

COMMENT ON COLUMN public.workspace_strategy_targets.max_assets_cap IS
  'Operator-intended value for on-chain strategyMaxAssets[strategy]. NUMERIC(78,0) = uint256. NULL = unset (treated as uncapped).';
