-- Fold public.wallets (global address registry) into profile_wallets.
-- chain / wallet_type / provider move onto the profile-scoped row;
-- drop the FK profile_wallets.address -> wallets(address).

BEGIN;

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS chain TEXT,
  ADD COLUMN IF NOT EXISTS wallet_type TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT;

UPDATE public.profile_wallets pw
SET
  chain = COALESCE(w.chain, pw.chain, 'evm'),
  wallet_type = COALESCE(w.wallet_type, pw.wallet_type, 'unknown'),
  provider = COALESCE(NULLIF(w.provider, ''), pw.provider, 'unknown')
FROM public.wallets w
WHERE lower(pw.address) = lower(w.address);

UPDATE public.profile_wallets
SET
  chain = COALESCE(chain, 'evm'),
  wallet_type = COALESCE(wallet_type, 'unknown'),
  provider = COALESCE(provider, 'unknown')
WHERE chain IS NULL OR wallet_type IS NULL OR provider IS NULL;

ALTER TABLE public.profile_wallets
  ALTER COLUMN chain SET DEFAULT 'evm',
  ALTER COLUMN wallet_type SET DEFAULT 'unknown',
  ALTER COLUMN provider SET DEFAULT 'unknown';

ALTER TABLE public.profile_wallets
  ALTER COLUMN chain SET NOT NULL,
  ALTER COLUMN wallet_type SET NOT NULL,
  ALTER COLUMN provider SET NOT NULL;

ALTER TABLE public.profile_wallets
  DROP CONSTRAINT IF EXISTS profile_wallets_address_fkey;

DROP TABLE IF EXISTS public.wallets CASCADE;

COMMENT ON COLUMN public.profile_wallets.chain IS 'Wallet chain slug (evm, solana, …). Formerly on public.wallets.';
COMMENT ON COLUMN public.profile_wallets.wallet_type IS 'Wallet role/type from Privy classification. Formerly on public.wallets.';
COMMENT ON COLUMN public.profile_wallets.provider IS 'Wallet provider (privy, coinbase_wallet, …). Formerly on public.wallets.';

COMMIT;
