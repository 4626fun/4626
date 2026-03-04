-- Pre-launch preference: keep subdomain feature lightweight.
-- Drop non-essential agent_subdomains helper indexes only.

DROP INDEX IF EXISTS public.agent_subdomains_owner_idx;
DROP INDEX IF EXISTS public.agent_subdomains_lens_owner_idx;
DROP INDEX IF EXISTS public.agent_subdomains_updated_idx;

-- Rollback (if needed):
-- CREATE INDEX IF NOT EXISTS agent_subdomains_owner_idx
--   ON public.agent_subdomains (owner_address);
-- CREATE INDEX IF NOT EXISTS agent_subdomains_lens_owner_idx
--   ON public.agent_subdomains (lens_owner_address);
-- CREATE INDEX IF NOT EXISTS agent_subdomains_updated_idx
--   ON public.agent_subdomains (updated_at DESC);
