-- Alfaclub live websocket message ingest table.
-- Moved from runtime bootstrap in frontend/server/_lib/alfaclub/schema.ts
-- and the legacy frontend/db mirror.
--
-- This is the single source of truth. All future changes go here.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.chat_ingest (
  room_id           TEXT NOT NULL,
  message_id        TEXT NOT NULL,
  sender_address    TEXT NOT NULL,
  message_text      TEXT NOT NULL DEFAULT '',
  message_date      TIMESTAMPTZ,
  username          TEXT,
  avatar_url        TEXT,
  is_bot            BOOLEAN,
  is_edited         BOOLEAN,
  edit_deadline     TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  deleted_by        TEXT,
  deleted_by_username TEXT,
  reply_id          TEXT,
  reply_date        TIMESTAMPTZ,
  reply_text        TEXT,
  reply_sender      TEXT,
  reply_username    TEXT,
  keys_count        INT,
  primary_tag       TEXT,
  primary_tag_variant TEXT,
  attachments_json  JSONB,
  reply_attachments_json JSONB,
  reactions_json    JSONB,
  message_payload_json JSONB,
  source            TEXT NOT NULL DEFAULT 'ws-live',
  raw_payload_text  TEXT,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, message_id)
);

-- RLS: deny-all by default (service role only)
ALTER TABLE alfaclub.chat_ingest ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'chat_ingest'
      AND policyname = 'chat_ingest_deny_all'
  ) THEN
    CREATE POLICY chat_ingest_deny_all
      ON alfaclub.chat_ingest FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

-- Common access patterns
CREATE INDEX IF NOT EXISTS chat_ingest_room_date_idx
  ON alfaclub.chat_ingest(room_id, message_date DESC);

CREATE INDEX IF NOT EXISTS chat_ingest_ingested_idx
  ON alfaclub.chat_ingest(ingested_at DESC);

-- Forward-compat columns (additive, safe on re-run)
-- These were historically applied in the TS bootstrap.
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS is_bot BOOLEAN;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS is_edited BOOLEAN;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS edit_deadline TIMESTAMPTZ;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS deleted_by_username TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_id TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_date TIMESTAMPTZ;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_text TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_sender TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_username TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS keys_count INT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS primary_tag TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS primary_tag_variant TEXT;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS attachments_json JSONB;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_attachments_json JSONB;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reactions_json JSONB;
ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS message_payload_json JSONB;

COMMENT ON TABLE alfaclub.chat_ingest IS
  'Live websocket + bridged message ingest for AlfaClub rooms. Service-role only. See chatIngestStore.ts and chatBridge.';
