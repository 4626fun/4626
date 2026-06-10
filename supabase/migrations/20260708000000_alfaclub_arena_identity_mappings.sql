-- Per-room / per-user Arena identity mapping.
-- sender_address='*' denotes the room default identity.

CREATE TABLE IF NOT EXISTS alfaclub.arena_identity_mapping (
  room_id                  TEXT NOT NULL,
  sender_address           TEXT NOT NULL DEFAULT '*',
  enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
  arena_agent_id           TEXT NOT NULL,
  arena_wallet_address     TEXT NOT NULL,
  hl_api_wallet_address    TEXT,
  updated_by               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address),
  CONSTRAINT arena_identity_sender_check
    CHECK (
      sender_address = '*'
      OR sender_address ~* '^0x[a-f0-9]{40}$'
    ),
  CONSTRAINT arena_identity_wallet_check
    CHECK (
      arena_wallet_address ~* '^0x[a-f0-9]{40}$'
    ),
  CONSTRAINT arena_identity_hl_wallet_check
    CHECK (
      hl_api_wallet_address IS NULL
      OR hl_api_wallet_address ~* '^0x[a-f0-9]{40}$'
    )
);

CREATE INDEX IF NOT EXISTS arena_identity_mapping_room_enabled_idx
  ON alfaclub.arena_identity_mapping (room_id, enabled);

ALTER TABLE alfaclub.arena_identity_mapping ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'arena_identity_mapping'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.arena_identity_mapping
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE alfaclub.arena_identity_mapping IS
  'Per-room/per-user Arena identity mapping. sender_address="*" is room default.';
