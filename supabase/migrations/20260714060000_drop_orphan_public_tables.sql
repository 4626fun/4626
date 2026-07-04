-- Drop public tables with zero production usage (July 2026 schema audit).
--
-- csw_owner_link_status: upsert module existed but had no callers; 0 rows.
-- referral_clicks: schema preflight only; never written; referral_conversions is live.

BEGIN;

DROP TABLE IF EXISTS public.csw_owner_link_status CASCADE;
DROP TABLE IF EXISTS public.referral_clicks CASCADE;

COMMIT;
