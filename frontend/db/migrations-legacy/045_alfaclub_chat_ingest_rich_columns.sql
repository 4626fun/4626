-- Expand alfaclub.chat_ingest to persist rich room-history payload fields.
-- Safe additive migration: no column drops, no type rewrites.

ALTER TABLE IF EXISTS alfaclub.chat_ingest
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN,
  ADD COLUMN IF NOT EXISTS edit_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_username TEXT,
  ADD COLUMN IF NOT EXISTS reply_id TEXT,
  ADD COLUMN IF NOT EXISTS reply_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_text TEXT,
  ADD COLUMN IF NOT EXISTS reply_sender TEXT,
  ADD COLUMN IF NOT EXISTS reply_username TEXT,
  ADD COLUMN IF NOT EXISTS keys_count INT,
  ADD COLUMN IF NOT EXISTS primary_tag TEXT,
  ADD COLUMN IF NOT EXISTS primary_tag_variant TEXT,
  ADD COLUMN IF NOT EXISTS attachments_json JSONB,
  ADD COLUMN IF NOT EXISTS reply_attachments_json JSONB,
  ADD COLUMN IF NOT EXISTS reactions_json JSONB,
  ADD COLUMN IF NOT EXISTS message_payload_json JSONB;

