-- Remove indexes with sustained zero scans to reduce insert/update write amplification.
-- Verified against pg_stat_user_indexes + pg_stat_statements in production.

DROP INDEX IF EXISTS public.agent_rate_limits_key_idx;
DROP INDEX IF EXISTS public.telegram_link_telemetry_events_event_idx;
DROP INDEX IF EXISTS public.telegram_link_telemetry_events_flow_idx;
