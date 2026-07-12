-- Single-use claim ledger for Enable 4626 activation owner-policy tokens.
-- Paymaster + complete-activation reject consumed/expired JTIs.

BEGIN;

CREATE TABLE IF NOT EXISTS activation_owner_token_claims (
  jti TEXT PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  privy_user_id TEXT NOT NULL,
  parent_csw_address TEXT NOT NULL,
  server_owner_address TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activation_owner_token_claims_profile_id_idx
  ON activation_owner_token_claims (profile_id);

CREATE INDEX IF NOT EXISTS activation_owner_token_claims_expires_at_idx
  ON activation_owner_token_claims (expires_at);

ALTER TABLE activation_owner_token_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activation_owner_token_claims_deny_all ON activation_owner_token_claims;
CREATE POLICY activation_owner_token_claims_deny_all ON activation_owner_token_claims
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE activation_owner_token_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE activation_owner_token_claims TO service_role;

COMMIT;
