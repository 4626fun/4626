-- Phase 5: functional indexes for LOWER(...) wallet/address lookups.

CREATE INDEX IF NOT EXISTS allowlist_address_active_lc_idx
  ON public.allowlist ((LOWER(address)))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS allowlist_csw_active_lc_idx
  ON public.allowlist ((LOWER(csw_address)))
  WHERE csw_address IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS access_requests_wallet_lc_created_idx
  ON public.access_requests ((LOWER(wallet_address)), created_at DESC);

CREATE INDEX IF NOT EXISTS creator_wallets_wallet_lc_idx
  ON public.creator_wallets ((LOWER(wallet_address)));

CREATE INDEX IF NOT EXISTS profile_wallets_address_lc_idx
  ON public.profile_wallets ((LOWER(address)));

CREATE INDEX IF NOT EXISTS wallets_address_lc_idx
  ON public.wallets ((LOWER(address)));

CREATE INDEX IF NOT EXISTS profiles_primary_wallet_lc_idx
  ON public.profiles ((LOWER(primary_wallet)))
  WHERE primary_wallet IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_embedded_wallet_lc_idx
  ON public.profiles ((LOWER(embedded_wallet)))
  WHERE embedded_wallet IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_primary_embedded_eoa_lc_idx
  ON public.profiles ((LOWER(primary_embedded_eoa)))
  WHERE primary_embedded_eoa IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_primary_smart_wallet_lc_idx
  ON public.profiles ((LOWER(primary_smart_wallet)))
  WHERE primary_smart_wallet IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_csw_address_lc_idx
  ON public.profiles ((LOWER(csw_address)))
  WHERE csw_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_base_sub_account_lc_idx
  ON public.profiles ((LOWER(base_sub_account)))
  WHERE base_sub_account IS NOT NULL;
