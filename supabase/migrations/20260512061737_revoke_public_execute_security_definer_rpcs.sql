-- Remove PUBLIC EXECUTE on internal SECURITY DEFINER RPCs (anon inherits PUBLIC).
-- Parity with remote migration version 20260512061737 (name: revoke_public_execute_security_definer_rpcs).

REVOKE EXECUTE ON FUNCTION public.backfill_zora_owner_ethos_from_cache(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.creator_access_requests_status_audit_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_creator_access_request_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_zora_owner_ethos_projection(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_review_fields_on_status_change() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.backfill_zora_owner_ethos_from_cache(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.creator_access_requests_status_audit_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_creator_access_request_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_zora_owner_ethos_projection(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_review_fields_on_status_change() TO service_role;
