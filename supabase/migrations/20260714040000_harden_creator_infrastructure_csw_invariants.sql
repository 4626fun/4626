-- Harden creator_infrastructure CSW invariants after keeper-EOA retirement.

BEGIN;

-- Clear legacy per-coin keeper EOAs on CSW rows (signer is privy_wallet_id, not agent_wallet_*).
UPDATE public.creator_infrastructure
SET
  agent_wallet_id = NULL,
  agent_wallet_address = NULL,
  updated_at = NOW()
WHERE agent_type = 'csw'
  AND xmtp_agent_address IS NOT NULL
  AND (agent_wallet_id IS NOT NULL OR agent_wallet_address IS NOT NULL);

-- Normalize any drifted CSW rows before constraints (xmtp inbox must equal parent CSW).
UPDATE public.creator_infrastructure
SET
  xmtp_agent_address = lower(csw_address),
  updated_at = NOW()
WHERE agent_type = 'csw'
  AND csw_address IS NOT NULL
  AND (
    xmtp_agent_address IS NULL
    OR lower(xmtp_agent_address) <> lower(csw_address)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_infrastructure_csw_xmtp_match'
      AND conrelid = 'public.creator_infrastructure'::regclass
  ) THEN
    ALTER TABLE public.creator_infrastructure
      ADD CONSTRAINT creator_infrastructure_csw_xmtp_match
      CHECK (
        agent_type <> 'csw'
        OR (
          csw_address IS NOT NULL
          AND xmtp_agent_address IS NOT NULL
          AND lower(xmtp_agent_address) = lower(csw_address)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_infrastructure_csw_requires_privy'
      AND conrelid = 'public.creator_infrastructure'::regclass
  ) THEN
    ALTER TABLE public.creator_infrastructure
      ADD CONSTRAINT creator_infrastructure_csw_requires_privy
      CHECK (
        agent_type <> 'csw'
        OR (privy_wallet_id IS NOT NULL AND btrim(privy_wallet_id) <> '')
      );
  END IF;
END
$$;

COMMENT ON TABLE public.creator_infrastructure IS
  'Per-creator automation infrastructure: parent CSW (custody + XMTP identity) + delegated Privy server signer (privy_wallet_id). Legacy agent_wallet_* keeper EOAs are retired.';

COMMIT;
