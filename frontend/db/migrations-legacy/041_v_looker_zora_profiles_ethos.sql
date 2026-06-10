-- Migration 041: Looker Studio source view for high-volume Zora reporting
--
-- Why
--   Looker Studio Community Connector queries should hit a stable, flat view
--   instead of ad-hoc joins over zora_profiles + zora_csw_owner_class.
--   This keeps schema changes isolated and reduces connector logic.
--
-- What this migration does
--   1) Creates public.v_looker_zora_profiles_ethos
--   2) Resolves a single "scoring wallet" per profile:
--      signing_eoa -> primary_wallet -> payout_recipient
--   3) Left-joins cached Ethos score columns from zora_csw_owner_class
--
-- Notes
--   - This is a read-only analytics view intended for service-role reads
--     through Apps Script.
--   - We intentionally expose a curated subset of columns that are useful
--     for dashboarding and outreach scoring.

BEGIN;

CREATE OR REPLACE VIEW public.v_looker_zora_profiles_ethos AS
WITH base AS (
  SELECT
    p.handle,
    p.zora_display_name,
    p.zora_creator_coin_symbol,
    p.zora_creator_coin_name,
    p.zora_creator_coin_address,
    p.zora_creator_coin_market_cap,
    p.zora_creator_coin_total_volume,
    p.unique_holders,
    p.volume_24h_usd,
    p.twitter_username,
    p.twitter_follower_count,
    p.farcaster_username,
    p.farcaster_follower_count,
    p.primary_wallet,
    p.signing_eoa,
    p.payout_recipient,
    p.smart_wallet_address,
    p.smart_wallet_kind,
    p.privy_wallet_address,
    p.privy_wallet_kind,
    p.primary_wallet_kind,
    p.recommended_install_source,
    p.recommended_install_target,
    p.signing_eoa_source,
    p.signing_eoa_balance_wei,
    p.payout_recipient_balance_wei,
    p.is_in_csw_index,
    p.last_refreshed_at
  FROM public.zora_profiles p
),
resolved AS (
  SELECT
    b.*,
    COALESCE(
      NULLIF(lower(b.signing_eoa), ''),
      NULLIF(lower(b.primary_wallet), ''),
      NULLIF(lower(b.payout_recipient), '')
    ) AS score_wallet
  FROM base b
)
SELECT
  r.handle,
  r.zora_display_name,
  r.zora_creator_coin_symbol,
  r.zora_creator_coin_name,
  r.zora_creator_coin_address,
  r.zora_creator_coin_market_cap,
  r.zora_creator_coin_total_volume,
  r.unique_holders,
  r.volume_24h_usd,
  r.twitter_username,
  r.twitter_follower_count,
  r.farcaster_username,
  r.farcaster_follower_count,
  r.primary_wallet,
  r.signing_eoa,
  r.payout_recipient,
  r.smart_wallet_address,
  r.smart_wallet_kind,
  r.privy_wallet_address,
  r.privy_wallet_kind,
  r.primary_wallet_kind,
  r.recommended_install_source,
  r.recommended_install_target,
  r.signing_eoa_source,
  r.signing_eoa_balance_wei,
  r.payout_recipient_balance_wei,
  r.is_in_csw_index,
  r.last_refreshed_at,
  r.score_wallet,
  c.ethos_userkey,
  c.ethos_score,
  c.ethos_level,
  c.ethos_score_updated_at
FROM resolved r
LEFT JOIN public.zora_csw_owner_class c
  ON lower(c.eoa) = r.score_wallet;

COMMENT ON VIEW public.v_looker_zora_profiles_ethos IS
  'Flattened Looker Studio source for Zora profile analytics with Ethos score join from zora_csw_owner_class.';

COMMIT;
