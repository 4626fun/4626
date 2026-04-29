-- Migration: AMOE ZK replay store (`amoe_zk_submissions`).
--
-- Off-chain mirror of `LotteryAmoeRouter`'s on-chain nullifier maps,
-- plus state-machine tracking the on-chain layer cannot express:
--   * In-flight tracking between proof generation and on-chain
--     confirmation (so a UI double-click returns "submission in flight"
--     instead of paying for a second PLONK proof).
--   * `ManagerDeclinedEntry` retry — the router intentionally reverts
--     when manager.processAmoeEntry returns 0 (paused/inactive). The
--     proof is still usable; this table tracks the retry pipeline.
--
-- Design doc: `docs/security/amoe-pr4-replay-store-design.md`.
--
-- KEEP THIS BLOCK BYTE-FOR-BYTE IDENTICAL to the runtime bootstrap in
-- `frontend/server/_lib/lottery/amoeReplayStore.ts:ensureAmoeReplayStoreSchema`.
-- Migration is the source of truth in CI / prod; runtime DDL is the
-- safety net for dev / preview where migrations may not be applied yet.

CREATE TABLE IF NOT EXISTS amoe_zk_submissions (
  -- Primary identity
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Caller binding
  signup_id                  BIGINT       NOT NULL,
  wallet_address             TEXT         NOT NULL,
  creator_coin               TEXT         NOT NULL,
  epoch                      BIGINT       NOT NULL,

  -- Proof commitments (canonical bytes32 hex; NULL until 'proven')
  nonce_commit_hex           TEXT,
  wallet_commit_hex          TEXT,
  points_burn_nullifier_hex  TEXT,

  -- The proof + pubInputs blob (kept for retry; NULL pre-prove and post-settle)
  proof_blob                 JSONB,
  proof_kept_until           TIMESTAMPTZ,

  -- Points burn binding
  spend_ref_id               TEXT         NOT NULL,
  points_burned              BIGINT       NOT NULL,

  -- State
  state                      TEXT         NOT NULL,
  state_reason               TEXT,

  -- Lifecycle timestamps
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  proven_at                  TIMESTAMPTZ,
  broadcast_at               TIMESTAMPTZ,
  settled_at                 TIMESTAMPTZ,

  -- On-chain trace (when applicable)
  tx_hash                    TEXT,
  block_number               BIGINT,
  manager_entry_id           BIGINT,

  -- Retry accounting
  retry_count                SMALLINT     NOT NULL DEFAULT 0,
  next_retry_at              TIMESTAMPTZ,
  last_retry_error           TEXT,
  -- In-flight claim marker. Set by `pickRetriesForCron` when a cron
  -- replica claims a row for retry; cleared by every terminal /
  -- intermediate state transition (markSettled / markManagerDeclined
  -- / markRejectedChain / markAbandonedEpochRolled). The reclaim
  -- sweeper only resurrects rows whose `retry_started_at` is older
  -- than 15 minutes, so overlapping cron replicas don't immediately
  -- requeue rows another worker is actively processing.
  retry_started_at           TIMESTAMPTZ,

  CONSTRAINT amoe_zk_submissions_state_chk CHECK (
    state IN (
      'pending',
      'proven',
      'broadcast',
      'manager_declined',
      'settled',
      'prove_failed',
      'rejected_chain',
      'abandoned'
    )
  )
);

-- Forward-compat for deployments that ran an earlier version of this
-- migration (PR 4 add-on for the cron reclaim race fix). On a fresh
-- install this is a no-op because the column already exists in the
-- CREATE TABLE block above.
ALTER TABLE amoe_zk_submissions
  ADD COLUMN IF NOT EXISTS retry_started_at TIMESTAMPTZ;

-- Replay key — mirrors the router's three on-chain mappings.
-- Partial unique on `nonce_commit_hex IS NOT NULL` is the portable
-- equivalent of `UNIQUE NULLS NOT DISTINCT` (PG 15+) and is safe on
-- PG 14 if any deployment is pinned older.
CREATE UNIQUE INDEX IF NOT EXISTS amoe_zk_submissions_nonce_commit_unique
  ON amoe_zk_submissions (nonce_commit_hex)
  WHERE nonce_commit_hex IS NOT NULL;

-- For "show me my submissions" + audit-time joins.
CREATE INDEX IF NOT EXISTS amoe_zk_submissions_signup_state_idx
  ON amoe_zk_submissions (signup_id, state, created_at DESC);

-- For the retry cron's `WHERE state='manager_declined' AND next_retry_at <= NOW()` pickup.
CREATE INDEX IF NOT EXISTS amoe_zk_submissions_retry_idx
  ON amoe_zk_submissions (next_retry_at)
  WHERE state = 'manager_declined';

-- For points-burn-nullifier lookups (matches on-chain map).
CREATE INDEX IF NOT EXISTS amoe_zk_submissions_pubnull_idx
  ON amoe_zk_submissions (points_burn_nullifier_hex)
  WHERE points_burn_nullifier_hex IS NOT NULL;

-- For wallet-commit-per-epoch lookups (matches on-chain map).
CREATE INDEX IF NOT EXISTS amoe_zk_submissions_walletcommit_idx
  ON amoe_zk_submissions (epoch, wallet_commit_hex)
  WHERE wallet_commit_hex IS NOT NULL;

-- RLS — same posture as `lottery_amoe_nonces` (service-role-only).
-- See `frontend/db/migrations/023_enable_rls_on_internal_public_tables.sql`.
ALTER TABLE amoe_zk_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amoe_zk_submissions_deny_all ON amoe_zk_submissions;
CREATE POLICY amoe_zk_submissions_deny_all
  ON amoe_zk_submissions
  FOR ALL
  USING (false)
  WITH CHECK (false);
