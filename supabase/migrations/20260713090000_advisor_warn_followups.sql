-- Follow-up to 20260713080000: clear the remaining WARN-level advisor findings.

-- cleanup_log_retention kept its default PUBLIC execute grant, so revoking from
-- anon/authenticated alone did not remove REST access. pg_cron runs it as postgres,
-- which retains execute as the function owner.
REVOKE EXECUTE ON FUNCTION public.cleanup_log_retention(
  integer, integer, integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer, integer, integer, integer
) FROM PUBLIC, anon, authenticated;

-- Pin search_path on the chat trigger helpers (mutable-search-path warnings).
ALTER FUNCTION public.set_message_threads_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_thread_on_message_insert() SET search_path = public;
ALTER FUNCTION public.add_creator_as_participant() SET search_path = public;
