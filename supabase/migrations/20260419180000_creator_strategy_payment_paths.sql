-- Extend creator_strategy_features to support multiple payment paths
-- (USDC-on-Base via plain transfer, x402 EIP-3009 authorized transfer,
-- and Stripe card checkout) + add admin-controlled price overrides for
-- discounts / comp / partner deals.
--
-- See docs/operations/creator-strategy-features.md § "Payment paths".
--
-- All changes are additive and backwards-compatible — existing rows stay
-- valid with `payment_source = 'usdc_base'` (the only path that existed
-- before this migration).

-- 1. Payment source discriminator on existing activations table.
ALTER TABLE public.creator_strategy_features
  ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'usdc_base'
    CHECK (payment_source IN ('usdc_base', 'x402_base', 'stripe'));

-- Relax the lowercase-hex check on payment_tx_hash to a SOFT check that
-- only applies when the value is non-null AND looks like a 0x hash.
-- Stripe rows populate `payment_tx_hash = NULL` and use
-- `stripe_charge_id` instead; x402 rows populate the settled Base tx hash.
--
-- The existing constraint already permits NULL so we keep it as-is; no
-- further change needed here.

-- 2. Stripe-specific columns.
ALTER TABLE public.creator_strategy_features
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS creator_strategy_features_unique_stripe_session
  ON public.creator_strategy_features (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- 3. x402 EIP-3009 nonce dedupe so one signed authorization can only
-- land once even if the client resubmits. EIP-3009 nonces are per-(from,
-- contract) per-authorization so we index on both.
ALTER TABLE public.creator_strategy_features
  ADD COLUMN IF NOT EXISTS x402_authorization_nonce TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS creator_strategy_features_unique_x402_nonce
  ON public.creator_strategy_features (payment_from, x402_authorization_nonce)
  WHERE x402_authorization_nonce IS NOT NULL;

-- 4. Admin-controlled price overrides (discounts, partner comps,
-- support refund replacements). An override matches on EITHER the
-- creator's wallet address OR a specific creator_token + feature_key
-- tuple. Most-specific match wins (creator_token beats wallet_address
-- when both are set).
CREATE TABLE IF NOT EXISTS public.creator_strategy_price_overrides (
  id BIGSERIAL PRIMARY KEY,

  -- Exactly one of these should be non-null. The lookup prefers
  -- creator_token when both are set (per-vault override), falling back
  -- to wallet_address (per-buyer override).
  creator_token TEXT,
  wallet_address TEXT,

  feature_key TEXT NOT NULL,

  -- Price the creator should pay, in USDC base units (6 decimals).
  -- `0` means the feature is free for this override. Must not exceed
  -- the catalog price (the handler clamps to `min(override, catalog)`).
  price_usdc_override NUMERIC(78, 0) NOT NULL
    CHECK (price_usdc_override >= 0),

  -- Free-form audit trail. Required so operators can explain later.
  reason TEXT NOT NULL,
  -- Operator who granted it (wallet address lowercased). Populated by
  -- the admin handler so we have a paper trail.
  granted_by TEXT,

  -- Optional expiry; NULL = no expiry.
  expires_at TIMESTAMPTZ,

  -- Soft-revoke without deleting so we keep the audit trail.
  revoked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exactly-one-of check: at least one identifier must be set.
ALTER TABLE public.creator_strategy_price_overrides
  DROP CONSTRAINT IF EXISTS creator_strategy_price_overrides_has_identifier;
ALTER TABLE public.creator_strategy_price_overrides
  ADD CONSTRAINT creator_strategy_price_overrides_has_identifier
    CHECK (creator_token IS NOT NULL OR wallet_address IS NOT NULL);

-- Lowercase-hex invariants so the lookup is case-insensitive-safe.
ALTER TABLE public.creator_strategy_price_overrides
  DROP CONSTRAINT IF EXISTS creator_strategy_price_overrides_creator_lowercase;
ALTER TABLE public.creator_strategy_price_overrides
  ADD CONSTRAINT creator_strategy_price_overrides_creator_lowercase
    CHECK (creator_token IS NULL OR creator_token = LOWER(creator_token));

ALTER TABLE public.creator_strategy_price_overrides
  DROP CONSTRAINT IF EXISTS creator_strategy_price_overrides_wallet_lowercase;
ALTER TABLE public.creator_strategy_price_overrides
  ADD CONSTRAINT creator_strategy_price_overrides_wallet_lowercase
    CHECK (wallet_address IS NULL OR wallet_address = LOWER(wallet_address));

-- Composite lookup indexes. We do two lookups on the hot path (per
-- creator_token + feature_key, then per wallet_address + feature_key if
-- no creator match), so index both.
CREATE INDEX IF NOT EXISTS creator_strategy_price_overrides_creator_idx
  ON public.creator_strategy_price_overrides (creator_token, feature_key)
  WHERE creator_token IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS creator_strategy_price_overrides_wallet_idx
  ON public.creator_strategy_price_overrides (wallet_address, feature_key)
  WHERE wallet_address IS NOT NULL AND revoked_at IS NULL;

-- Only one live (non-revoked, non-expired) override per (creator_token,
-- feature_key) — operators should revoke + re-insert rather than update,
-- for audit. Enforced via partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS creator_strategy_price_overrides_one_live_per_creator
  ON public.creator_strategy_price_overrides (creator_token, feature_key)
  WHERE creator_token IS NOT NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_strategy_price_overrides_one_live_per_wallet
  ON public.creator_strategy_price_overrides (wallet_address, feature_key)
  WHERE wallet_address IS NOT NULL AND revoked_at IS NULL;

-- RLS: deny public + keep server-only. Matches the pattern from the
-- original creator_strategy_features migration.
ALTER TABLE public.creator_strategy_price_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest_creator_strategy_price_overrides"
  ON public.creator_strategy_price_overrides;
CREATE POLICY "deny_public_rest_creator_strategy_price_overrides"
  ON public.creator_strategy_price_overrides
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.creator_strategy_price_overrides_touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_strategy_price_overrides_touch_updated_at
  ON public.creator_strategy_price_overrides;
CREATE TRIGGER creator_strategy_price_overrides_touch_updated_at
  BEFORE UPDATE ON public.creator_strategy_price_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.creator_strategy_price_overrides_touch_updated_at();
