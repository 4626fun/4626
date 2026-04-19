-- Creator strategy features — per-creator opt-in paid features.
--
-- Each row represents a creator's activation of a catalog feature paid
-- for in USDC on Base mainnet. Every productive strategy on a
-- `CreatorOVault` (Charm, Ajna, Solana bridge) is gated by an activation
-- here; there is no free baseline. Post-deploy add-ons (e.g.
-- `solana_meteora_alpha_vault`) also live in this table. See
-- `docs/operations/creator-strategy-features.md` for the full product
-- model.
--
-- Lifecycle:
--   pending   — USDC payment received + verified; operator has not yet
--               provisioned the underlying onchain/Solana-side infra.
--   active    — Provisioner has completed setup; the feature is live for
--               this creator.
--   failed    — Provisioning hit a terminal error (e.g. Solana RPC down,
--               insufficient SOL on keeper). Operator must manually
--               intervene or refund.
--   refunded  — Activation was explicitly reversed (operator decision).
--
-- USDC payments go to `protocolTreasury` (`0x7d429e...f2d3`). Payment is a
-- plain ERC-20 `Transfer(from=creator, to=treasury, value>=priceUsdc)` on
-- Base's USDC contract (`0x833589fc...b54bdA02913`). The server verifies
-- the transaction receipt before moving an activation out of `pending`.
--
-- A creator can have AT MOST ONE non-terminal row per feature:
--   UNIQUE (creator_token, feature_key) WHERE status IN ('pending','active')
-- Failed/refunded rows are retained for audit; a new activation for the
-- same feature is allowed after failure.

CREATE TABLE IF NOT EXISTS public.creator_strategy_features (
  id BIGSERIAL PRIMARY KEY,
  creator_token TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'failed', 'refunded')),
  -- Amount actually paid (USDC base units, 6 decimals). Preserved even if
  -- catalog price later changes so historical activations stay auditable.
  price_usdc_paid NUMERIC(78, 0) NOT NULL,
  -- Base mainnet tx hash of the USDC Transfer event that funded this
  -- activation. Unique across the whole table so the same payment can't
  -- be claimed twice.
  payment_tx_hash TEXT,
  payment_from TEXT,
  payment_to TEXT,
  payment_verified_at TIMESTAMPTZ,
  -- Timestamps for each lifecycle transition.
  provisioned_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  -- Free-form reference to the external provisioning record (e.g. Solana
  -- DLMM pool pubkey, Alpha Vault pubkey, or internal job id).
  provisioner_ref TEXT,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalization: creator_token and payment_tx_hash must be lowercase hex.
-- Enforce via CHECK so any code path that writes a mixed-case value fails
-- at insert time rather than silently deduplicating poorly.
ALTER TABLE public.creator_strategy_features
  DROP CONSTRAINT IF EXISTS creator_strategy_features_creator_token_lowercase;
ALTER TABLE public.creator_strategy_features
  ADD CONSTRAINT creator_strategy_features_creator_token_lowercase
    CHECK (creator_token = LOWER(creator_token));

ALTER TABLE public.creator_strategy_features
  DROP CONSTRAINT IF EXISTS creator_strategy_features_payment_tx_hash_lowercase;
ALTER TABLE public.creator_strategy_features
  ADD CONSTRAINT creator_strategy_features_payment_tx_hash_lowercase
    CHECK (payment_tx_hash IS NULL OR payment_tx_hash = LOWER(payment_tx_hash));

-- One active/pending row per (creator, feature). Retries after failure
-- create a new row (prior row stays `failed`).
CREATE UNIQUE INDEX IF NOT EXISTS creator_strategy_features_one_live_per_feature
  ON public.creator_strategy_features (creator_token, feature_key)
  WHERE status IN ('pending', 'active');

-- Dedupe on payment tx so the same USDC transfer can't fund two activations.
CREATE UNIQUE INDEX IF NOT EXISTS creator_strategy_features_unique_payment_tx
  ON public.creator_strategy_features (payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_strategy_features_creator_idx
  ON public.creator_strategy_features (creator_token);

CREATE INDEX IF NOT EXISTS creator_strategy_features_status_idx
  ON public.creator_strategy_features (status);

-- RLS: default-deny. The server (connecting as `postgres` via the Supabase
-- pooler) bypasses RLS for reads/writes. PostgREST (`anon` / `authenticated`)
-- is denied by default, so the table is effectively server-only without
-- needing explicit policies. Matches the pattern in AGENTS.md → "New public
-- tables require RLS".
ALTER TABLE public.creator_strategy_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest_creator_strategy_features"
  ON public.creator_strategy_features;
CREATE POLICY "deny_public_rest_creator_strategy_features"
  ON public.creator_strategy_features
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- Bump updated_at on writes for simple audit.
CREATE OR REPLACE FUNCTION public.creator_strategy_features_touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_strategy_features_touch_updated_at
  ON public.creator_strategy_features;
CREATE TRIGGER creator_strategy_features_touch_updated_at
  BEFORE UPDATE ON public.creator_strategy_features
  FOR EACH ROW
  EXECUTE FUNCTION public.creator_strategy_features_touch_updated_at();
