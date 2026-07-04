-- Phase 3a: creator_infrastructure uses csw_address as the sole XMTP identity.
-- Drop redundant xmtp_agent_address and remove pre-cutover legacy CSW row.

BEGIN;

DELETE FROM public.creator_infrastructure
WHERE lower(creator_address) = lower('0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef');

ALTER TABLE public.creator_infrastructure
  DROP CONSTRAINT IF EXISTS creator_infrastructure_csw_xmtp_match;

DROP INDEX IF EXISTS public.creator_infrastructure_listed_idx;

ALTER TABLE public.creator_infrastructure
  DROP COLUMN IF EXISTS xmtp_agent_address;

CREATE INDEX IF NOT EXISTS creator_infrastructure_listed_idx
  ON public.creator_infrastructure (listed_publicly, created_at DESC)
  WHERE csw_address IS NOT NULL;

COMMENT ON TABLE public.creator_infrastructure IS
  'Per-creator CSW automation: parent CSW (custody + XMTP identity) + delegated Privy server signer (privy_wallet_id).';

COMMIT;
