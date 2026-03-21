DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_wallets'
      AND column_name = 'canonical_zora_csw_address'
  ) THEN
    ALTER TABLE public.profile_wallets
      RENAME COLUMN canonical_zora_csw_address TO canonical_csw_address;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'account_zora_signals'
      AND column_name = 'canonical_zora_csw_address'
  ) THEN
    ALTER TABLE public.account_zora_signals
      RENAME COLUMN canonical_zora_csw_address TO canonical_csw_address;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.profile_wallets_canonical_zora_csw_lc_idx
  RENAME TO profile_wallets_canonical_csw_lc_idx;
