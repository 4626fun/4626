-- Retire legacy EOA keeper/XMTP rows and drop obsolete creator_infrastructure columns.

BEGIN;

-- Legacy EOA agents are retired in application code (CSW + delegated Privy signer only).
DELETE FROM public.creator_infrastructure
WHERE agent_type = 'eoa';

-- Per-coin Privy keeper EOAs are retired; signer is privy_wallet_id on the parent CSW.
ALTER TABLE public.creator_infrastructure
  DROP COLUMN IF EXISTS agent_wallet_id,
  DROP COLUMN IF EXISTS agent_wallet_address;

-- Encrypted EOA XMTP key material is retired; CSW agents sign via Privy API.
ALTER TABLE public.creator_infrastructure
  DROP COLUMN IF EXISTS encrypted_private_key_b64,
  DROP COLUMN IF EXISTS encrypted_private_key_iv_b64,
  DROP COLUMN IF EXISTS encrypted_private_key_tag_b64;

ALTER TABLE public.creator_infrastructure
  ALTER COLUMN agent_type SET DEFAULT 'csw';

ALTER TABLE public.creator_infrastructure
  DROP CONSTRAINT IF EXISTS creator_infrastructure_agent_type_check;

ALTER TABLE public.creator_infrastructure
  ADD CONSTRAINT creator_infrastructure_agent_type_check
  CHECK (agent_type = 'csw');

COMMENT ON TABLE public.creator_infrastructure IS
  'Per-creator CSW automation: parent CSW (custody + XMTP identity) + delegated Privy server signer (privy_wallet_id).';

COMMIT;
