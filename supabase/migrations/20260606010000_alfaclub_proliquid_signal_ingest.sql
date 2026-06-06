-- ProLiquid assistive signal ingest + scoring cache.
-- This lane is informational-only and must not trigger autonomous execution.

CREATE TABLE IF NOT EXISTS alfaclub.proliquid_signal_ingest (
  source_chat_id        TEXT NOT NULL,
  source_message_id     BIGINT NOT NULL,
  source_thread_id      BIGINT,
  source_user_id        TEXT,
  source_username       TEXT,
  source_posted_at      TIMESTAMPTZ,
  destination_room_id   TEXT,
  signal_kind           TEXT NOT NULL DEFAULT 'unknown',
  raw_text              TEXT NOT NULL,
  normalized_text       TEXT NOT NULL,
  ingest_status         TEXT NOT NULL DEFAULT 'pending',
  score_confidence      TEXT,
  score_value           INTEGER,
  score_summary         TEXT,
  score_metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  scored_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_chat_id, source_message_id),
  CONSTRAINT proliquid_signal_ingest_status_check
    CHECK (ingest_status IN ('pending', 'scored', 'skipped', 'error')),
  CONSTRAINT proliquid_signal_kind_check
    CHECK (signal_kind IN ('liquidations', 'whales', 'copy_trading', 'unknown')),
  CONSTRAINT proliquid_signal_confidence_check
    CHECK (score_confidence IS NULL OR score_confidence IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS proliquid_signal_ingest_status_created_idx
  ON alfaclub.proliquid_signal_ingest (ingest_status, created_at DESC);

CREATE INDEX IF NOT EXISTS proliquid_signal_ingest_room_status_created_idx
  ON alfaclub.proliquid_signal_ingest (destination_room_id, ingest_status, created_at DESC);

ALTER TABLE alfaclub.proliquid_signal_ingest ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'proliquid_signal_ingest'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.proliquid_signal_ingest
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE alfaclub.proliquid_signal_ingest IS
  'Server-only ProLiquid Telegram signal ingest/scoring cache (assistive lane only).';
