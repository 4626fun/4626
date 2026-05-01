-- Migration: Per-user AlfaClub chat preferences (Hermit personalization).
--
-- Motivation
-- ----------
-- Hermit (Pinata creative lane) supports a Spanish dialect signal per
-- chat turn — flag emoji or text hint — and previously persisted that
-- choice into a workspace-wide MEMORY.md file. That worked for a single
-- operator playing alone, but in a multi-room chat with many senders,
-- one user's `🇲🇽` would change Hermit's dialect for *everyone* until
-- another flag rewrote MEMORY.md.
--
-- This migration introduces a per-(room, sender) preference table so
-- the explicit signal from one user only personalizes that user's
-- subsequent replies. The room remains the natural scope because
-- AlfaClub rooms are per-creator and a sender's identity is the
-- normalized lower-case wallet that posted the message.
--
-- Scope and boundary
-- ------------------
-- - Owned by the AlfaClub bridge / Vercel control plane.
--   `frontend/server/_lib/alfaclub/userPreferenceStore.ts` is the only
--   writer. Pinata / Hermit creative code MUST NOT touch this table —
--   the architecture-boundary tests enforce that invariant.
-- - This is NOT auth state. No Privy session, no JWT, no refresh token
--   ever lands here. Preferences are user-visible style only.
-- - Generic key/value shape so future preferences (tone, meme style,
--   emoji density, …) can ride the same table without another
--   migration.
--
-- Data shape
-- ----------
--   room_id           — AlfaClub room id (string of digits in prod;
--                       store as TEXT to mirror chat_ingest).
--   sender_address    — Lower-cased EVM address of the message sender.
--   preference_key    — Free-form key, namespaced by feature
--                       (e.g. 'hermit.spanish_dialect').
--   preference_value  — Free-form short string. NULL means "explicitly
--                       unset" (different from row-not-present).
--   updated_by        — Tag describing the writer
--                       (e.g. 'hermit.flag', 'hermit.text-hint',
--                       'admin.api'). Useful for audit and to debug
--                       which signal wrote which value.
--   created_at,
--   updated_at        — Standard timestamps.
--
-- Idempotency: PRIMARY KEY (room_id, sender_address, preference_key)
-- with `INSERT ... ON CONFLICT DO UPDATE` from the store module.
--
-- Privacy / cleanup
-- -----------------
-- Rows are keyed by wallet, which is already public chat metadata.
-- Operators can purge a sender's prefs with:
--   DELETE FROM alfaclub.user_preference WHERE sender_address = lower($1);
-- Or scope to a single room:
--   DELETE FROM alfaclub.user_preference
--   WHERE room_id = $1 AND sender_address = lower($2);
--
-- This migration is byte-for-byte identical to its sibling:
--   `frontend/db/migrations/036_alfaclub_user_preferences.sql`.
-- Keep them in lockstep.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.user_preference (
  room_id           TEXT NOT NULL,
  sender_address    TEXT NOT NULL,
  preference_key    TEXT NOT NULL,
  preference_value  TEXT,
  updated_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address, preference_key)
);

ALTER TABLE alfaclub.user_preference ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'user_preference'
      AND policyname = 'user_preference_deny_all'
  ) THEN
    CREATE POLICY user_preference_deny_all
      ON alfaclub.user_preference FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS user_preference_sender_idx
  ON alfaclub.user_preference(sender_address);

COMMENT ON TABLE alfaclub.user_preference IS
  'Per-(room, sender) AlfaClub chat personalization. Owned by the Vercel chat-bridge / Hermit lane. Generic key/value; first user is hermit.spanish_dialect. NEVER stores auth/session material — see frontend/server/_lib/alfaclub/userPreferenceStore.ts.';
