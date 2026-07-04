-- Retire vault_chat_policies / vault_chat_memberships (0 rows in prod).
-- Holder-gated vault chat was never shipped; keepr vault registry remains the
-- source of truth for group/gating when that feature is rebuilt.

BEGIN;

DROP TABLE IF EXISTS public.vault_chat_memberships CASCADE;
DROP TABLE IF EXISTS public.vault_chat_policies CASCADE;

COMMIT;
