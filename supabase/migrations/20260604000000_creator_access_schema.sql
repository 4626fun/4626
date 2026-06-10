-- Creator access allowlist and access request tables.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/db/postgres.ts (ensureCreatorAccessSchema).

CREATE TABLE IF NOT EXISTS allowlist (
  address TEXT PRIMARY KEY,
  csw_address TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS allowlist_address_active_lc_idx
  ON allowlist ((LOWER(address)))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS allowlist_csw_active_lc_idx
  ON allowlist ((LOWER(csw_address)))
  WHERE csw_address IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS access_requests (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  coin_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  decision_note TEXT
);

-- Enforce status values via CHECK (no enum needed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'access_requests_status_check'
  ) THEN
    ALTER TABLE access_requests
      ADD CONSTRAINT access_requests_status_check
      CHECK (status IN ('pending', 'approved', 'denied'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS access_requests_status_created_idx ON access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS access_requests_wallet_lc_created_idx
  ON access_requests ((LOWER(wallet_address)), created_at DESC);

COMMENT ON TABLE allowlist IS 'Creator access allowlist (wallet → csw).';
COMMENT ON TABLE access_requests IS 'Pending/approved/denied creator access requests.';