-- Archive legacy creator_strategy_features rows and document retired catalog keys.
--
-- Context (2026-07 audit): prod still holds failed $100 Stripe checkout rows from
-- the pre-$499 bundle era plus one retired solana_bridge_strategy attempt.
-- Active entitlements (solana_ovault_mesh, pending vault_full_deploy) are untouched.

BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_strategy_catalog_notes (
  feature_key text PRIMARY KEY,
  catalog_status text NOT NULL CHECK (catalog_status IN ('active', 'bundle_only', 'retired', 'legacy_grandfather')),
  catalog_price_usdc bigint,
  notes text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.creator_strategy_catalog_notes IS
'Read-only catalog authority mirror for operator queries. Runtime purchase gates live in frontend/server/_lib/creatorStrategy/catalog.ts.';

INSERT INTO public.creator_strategy_catalog_notes (feature_key, catalog_status, catalog_price_usdc, notes)
VALUES
  (
    'vault_full_deploy',
    'active',
    499000000,
    'Single public SKU ($499 USDC). Expands into charm_active_lp, ajna_sleeve, solana_ovault_mesh, solana_meteora_alpha_vault.'
  ),
  (
    'charm_active_lp',
    'bundle_only',
    NULL,
    'Not sold à-la-carte for greenfield deploys. Legacy operator comps and bundle expansion only.'
  ),
  (
    'ajna_sleeve',
    'bundle_only',
    NULL,
    'Not sold à-la-carte for greenfield deploys. Legacy operator comps and bundle expansion only.'
  ),
  (
    'solana_ovault_mesh',
    'bundle_only',
    NULL,
    'Bundled with vault_full_deploy. Grandfathered admin comps remain valid.'
  ),
  (
    'solana_meteora_alpha_vault',
    'bundle_only',
    NULL,
    'Bundled with vault_full_deploy.'
  ),
  (
    'solana_bridge_strategy',
    'retired',
    NULL,
    'Retired 2026-04. Greenfield vaults seed Solana via ShareOFT auto-bridge at finalizePhase2. Use solana_ovault_mesh for cross-chain compose.'
  )
ON CONFLICT (feature_key) DO UPDATE SET
  catalog_status = EXCLUDED.catalog_status,
  catalog_price_usdc = EXCLUDED.catalog_price_usdc,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Stamp archive metadata on legacy failed Stripe rows (idempotent).
UPDATE public.creator_strategy_features
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'archived_at', to_jsonb(now()),
    'archive_pass', '20260714150000',
    'archive_reason', CASE
      WHEN feature_key = 'solana_bridge_strategy' THEN 'retired_feature_key'
      WHEN price_usdc_paid = 100000000 AND payment_source = 'stripe' THEN 'legacy_stripe_checkout_superseded'
      ELSE 'legacy_row_documented'
    END,
    'superseded_by', 'vault_full_deploy',
    'catalog_price_usdc_current', 499000000,
    'catalog_reference', 'frontend/server/_lib/creatorStrategy/catalog.ts'
  ),
  updated_at = GREATEST(updated_at, now())
WHERE status = 'failed'
  AND (
    feature_key = 'solana_bridge_strategy'
    OR (price_usdc_paid = 100000000 AND payment_source = 'stripe')
  )
  AND COALESCE(metadata->>'archive_pass', '') <> '20260714150000';

COMMENT ON TABLE public.creator_strategy_features IS
'Per-creator strategy entitlements. Purchase catalog: frontend/server/_lib/creatorStrategy/catalog.ts; retired keys documented in creator_strategy_catalog_notes.';

COMMIT;
