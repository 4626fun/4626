-- Security hardening (Supabase advisor): views as security invoker, RLS policy
-- for sankey table, revoke client RPC on internal SECURITY DEFINER functions, fixed search_path.
-- Parity with remote migration version 20260512061657 (name: harden_security_advisors_20260211).

-- 1) Views: prefer invoker semantics (Postgres 15+)
ALTER VIEW public.points_amoe_eligible_balance SET (security_invoker = true);
ALTER VIEW public.v_looker_zora_profiles_ethos SET (security_invoker = true);
ALTER VIEW public.v_zora_owner_ethos_sync_health SET (security_invoker = true);

-- 2) RLS enabled but no policies: explicit service_role policy (denies anon/auth by default)
DROP POLICY IF EXISTS sankey_lookerstudio_full_dataset_service_role_all ON public.sankey_lookerstudio_full_dataset;
CREATE POLICY sankey_lookerstudio_full_dataset_service_role_all
  ON public.sankey_lookerstudio_full_dataset
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) SECURITY DEFINER RPCs: not callable from PostgREST anon/authenticated clients
REVOKE EXECUTE ON FUNCTION public.backfill_zora_owner_ethos_from_cache(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rows() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_legacy_backups(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_log_retention(integer, integer, integer, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.creator_access_requests_audit_fn() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.creator_access_requests_status_audit_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_creator_access_request_audit(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_creator_access_request_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_creator_addresses() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_zora_owner_ethos_projection(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_review_fields_on_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at_creator_access_requests() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.backfill_zora_owner_ethos_from_cache(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rows() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_legacy_backups(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_log_retention(integer, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.creator_access_requests_audit_fn() TO service_role;
GRANT EXECUTE ON FUNCTION public.creator_access_requests_status_audit_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_creator_access_request_audit(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_creator_access_request_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_creator_addresses() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_zora_owner_ethos_projection(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_review_fields_on_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at_creator_access_requests() TO service_role;

-- 4) Mutable search_path on functions
ALTER FUNCTION public.creator_strategy_features_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.creator_strategy_price_overrides_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_alfaclub_explore_latest(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_alfaclub_rooms_snapshot(jsonb) SET search_path = public, pg_temp;
