-- Drop protocol tables whose Shovel integrations were enabled:false.
-- KEEP required_enabled: phase1_deployed, lottery_winners, lottery_multi_jackpot,
--   lottery_entries, share_oft_buy_fees.
-- Pair with indexer/shovel/render-config.mjs + 001_protocol_index_rls.sql updates.

DROP TABLE IF EXISTS public.protocol_phase2_launched CASCADE;
DROP TABLE IF EXISTS public.protocol_share_bridge_solana CASCADE;
DROP TABLE IF EXISTS public.protocol_vault_burn_stream_set CASCADE;
DROP TABLE IF EXISTS public.protocol_burn_stream_dripped CASCADE;
DROP TABLE IF EXISTS public.protocol_share_oft_transfers CASCADE;
