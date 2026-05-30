-- Alfaclub daily brief dispatch table (inside alfaclub private schema).
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/alfaclub/dailyBrief.ts.
-- This was the last significant raw DDL block inside a dedicated schema.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.daily_brief_dispatch (
  dispatch_key TEXT PRIMARY KEY,
  snapshot_ts TIMESTAMPTZ NOT NULL,
  previous_snapshot_ts TIMESTAMPTZ NULL,
  room_id TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE alfaclub.daily_brief_dispatch IS 'Tracks sent daily brief messages per room/snapshot to avoid duplicates in AlfaClub.';

-- No public RLS needed here as it's inside a private schema with service-role only access patterns.
