-- Drop orphaned monitoring view with no runtime consumers.

BEGIN;

DROP VIEW IF EXISTS public.v_zora_profiles_refresh_freshness CASCADE;

COMMIT;
