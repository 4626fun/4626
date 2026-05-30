-- Migration 048: paid on-demand creator Ethos projection refresh orders.

BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_ethos_refresh_orders (
  id BIGSERIAL PRIMARY KEY,
  creator_address TEXT NOT NULL,
  coin_address TEXT NULL,
  payer_address TEXT NOT NULL,
  price_usdc_paid BIGINT NOT NULL,
  payment_tx_hash TEXT NOT NULL,
  payment_to TEXT NOT NULL,
  ethos_score_before INTEGER NULL,
  ethos_score_after INTEGER NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_ethos_refresh_orders_payment_tx_hash_uidx
  ON public.creator_ethos_refresh_orders (lower(payment_tx_hash));

CREATE INDEX IF NOT EXISTS creator_ethos_refresh_orders_creator_created_idx
  ON public.creator_ethos_refresh_orders (lower(creator_address), created_at DESC);

ALTER TABLE public.creator_ethos_refresh_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_ethos_refresh_orders'
      AND policyname = 'creator_ethos_refresh_orders_deny_public_rest'
  ) THEN
    CREATE POLICY creator_ethos_refresh_orders_deny_public_rest
      ON public.creator_ethos_refresh_orders
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE public.creator_ethos_refresh_orders IS
  'Paid USDC orders that trigger a single-creator Ethos score re-fetch and creator_ethos_projection upsert.';

COMMIT;
