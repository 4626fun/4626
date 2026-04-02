-- Pre-launch safety rollback: restore indexes dropped in phase 7 reconcile.
-- We will keep monitoring enabled but avoid aggressive pruning before launch.

CREATE INDEX IF NOT EXISTS agent_api_logs_endpoint_idx
  ON public.agent_api_logs (endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_clicks_referrer_created_idx
  ON public.referral_clicks (referrer_signup_id, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_clicks_code_created_idx
  ON public.referral_clicks (referral_code, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_conversions_code_created_idx
  ON public.referral_conversions (referral_code, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_subdomains_owner_idx
  ON public.agent_subdomains (owner_address);

CREATE INDEX IF NOT EXISTS agent_subdomains_lens_owner_idx
  ON public.agent_subdomains (lens_owner_address);

CREATE INDEX IF NOT EXISTS agent_subdomains_updated_idx
  ON public.agent_subdomains (updated_at DESC);

CREATE INDEX IF NOT EXISTS creator_coins_last_seen_idx
  ON public.creator_coins (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS creators_first_seen_idx
  ON public.creators (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS wallets_type_idx
  ON public.wallets (wallet_type);;
