-- Phase 2 conservative unused-index pruning.
-- Scope: low-traffic log/referral helper indexes only.

DROP INDEX IF EXISTS public.admin_logs_action_idx;
DROP INDEX IF EXISTS public.admin_logs_admin_idx;
DROP INDEX IF EXISTS public.admin_logs_target_idx;
DROP INDEX IF EXISTS public.agent_api_logs_endpoint_idx;
DROP INDEX IF EXISTS public.referral_clicks_referrer_created_idx;
DROP INDEX IF EXISTS public.referral_clicks_code_created_idx;
DROP INDEX IF EXISTS public.referral_conversions_code_created_idx;

-- Rollback (if needed):
-- CREATE INDEX IF NOT EXISTS admin_logs_admin_idx
--   ON public.admin_logs (admin_address, created_at DESC);
-- CREATE INDEX IF NOT EXISTS admin_logs_action_idx
--   ON public.admin_logs (action, created_at DESC);
-- CREATE INDEX IF NOT EXISTS admin_logs_target_idx
--   ON public.admin_logs (target_type, target_id);
-- CREATE INDEX IF NOT EXISTS agent_api_logs_endpoint_idx
--   ON public.agent_api_logs (endpoint, created_at DESC);
-- CREATE INDEX IF NOT EXISTS referral_clicks_referrer_created_idx
--   ON public.referral_clicks (referrer_signup_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS referral_clicks_code_created_idx
--   ON public.referral_clicks (referral_code, created_at DESC);
-- CREATE INDEX IF NOT EXISTS referral_conversions_code_created_idx
--   ON public.referral_conversions (referral_code, created_at DESC);
