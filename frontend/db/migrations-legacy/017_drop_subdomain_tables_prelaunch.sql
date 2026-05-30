-- Pre-launch cleanup: remove deprecated subdomain persistence tables.
-- The subdomain APIs/indexer have been retired from the app.

DROP TABLE IF EXISTS public.agent_subdomain_indexer_state;
DROP TABLE IF EXISTS public.agent_subdomains;
