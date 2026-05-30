-- Migration: AMOE points-burn ledger publisher runs.
--
-- Tracks the lifecycle of every cron tick that drives an epoch through
-- the publish pipeline (project → build → broadcast → confirm). One
-- row per (epoch, run-attempt). Owned exclusively by the publisher
-- cron at `/api/v1/lottery/amoe/publish-cron`.
--
-- LOCK SEMANTICS (single-instance gate):
-- =====================================
-- Multiple Vercel pods can fire the cron at the same minute. We must
-- never let two pods broadcast the same epoch's root concurrently —
-- the on-chain `LotteryAmoeRouter.setPointsLedgerRoot` call has a
-- one-shot guard (`PointsLedgerEpochAlreadyPublished`), but losing
-- that race wastes gas and pollutes the audit trail.
--
-- The lock is implemented as a partial UNIQUE index on `(epoch)` that
-- only applies to in-flight runs (`finished_at IS NULL`). Two pods
-- racing to claim the same epoch will see exactly one INSERT succeed;
-- the loser sees a unique-violation and skips that epoch this tick.
--
-- A claim becomes stale 10 minutes after `claimed_at` (per
-- `STRANDED_RUN_RECLAIM_AGE_MS` in the publisher); the cron's reclaim
-- pass marks stale runs `errored` so the next tick can re-claim.
--
-- STATE MACHINE:
-- ==============
-- phase ∈ {
--   'projecting',     -- L0 → L1 in progress
--   'building',       -- L1 → L2 (state 1) in progress
--   'broadcasting',   -- L2 state-1 → state-2 (tx submitted)
--   'confirming',     -- L2 state-2 → state-3 (waiting for receipt)
--   'finished',       -- terminal (snapshot confirmed on-chain)
--   'finished_no_op', -- terminal (epoch had zero burns; no on-chain write)
--   'errored'         -- terminal (run abandoned; reclaim path)
-- }
--
-- Forward transitions are monotonic; only the publisher cron writes
-- this column. Manual recovery requires updating phase to 'errored'
-- + setting finished_at; never roll back.
--
-- Design doc: `docs/security/amoe-pr5b-publisher-design.md` §9.
--
-- This migration is byte-for-byte identical to its sibling:
--   `supabase/migrations/20260429020000_amoe_publisher_runs.sql`.
-- Keep them in lockstep — diverging the two will trip the docs-drift CI.

-- ---------------------------------------------------------------------------
-- amoe_publisher_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amoe_publisher_runs (
  -- Identity
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch           BIGINT        NOT NULL CHECK (epoch >= 0),

  -- Lifecycle
  phase           TEXT          NOT NULL CHECK (
    phase IN (
      'projecting',
      'building',
      'broadcasting',
      'confirming',
      'finished',
      'finished_no_op',
      'errored'
    )
  ),

  -- Lock metadata
  claimed_by      TEXT          NOT NULL,  -- e.g. 'vercel-pod-<host>'
  claimed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Lifecycle timestamps
  started_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,  -- NULL while in flight; set on terminal phase

  -- Error context (populated for terminal 'errored' phase or reclaim)
  last_error      TEXT,

  -- Foreign-key sanity: when the run produces an L2 snapshot, this is
  -- the run that wrote it. NOT enforced as FK because the L2 row may
  -- be deleted in a manual recovery without rolling back this audit row.
  snapshot_epoch  BIGINT,

  CONSTRAINT amoe_publisher_runs_finished_consistency CHECK (
    -- In-flight: phase is non-terminal, finished_at is null
    (phase IN ('projecting', 'building', 'broadcasting', 'confirming') AND finished_at IS NULL)
    OR
    -- Terminal: phase is one of the three end states, finished_at is set
    (phase IN ('finished', 'finished_no_op', 'errored') AND finished_at IS NOT NULL)
  )
);

-- Single-instance lock: only ONE in-flight run per epoch. Conflicts on
-- this index are how losing pods detect "another pod has this epoch".
CREATE UNIQUE INDEX IF NOT EXISTS amoe_publisher_runs_epoch_in_flight_idx
  ON amoe_publisher_runs (epoch)
  WHERE finished_at IS NULL;

-- Look up the most recent run for an epoch (operator drill / observability).
CREATE INDEX IF NOT EXISTS amoe_publisher_runs_epoch_started_idx
  ON amoe_publisher_runs (epoch, started_at DESC);

-- Reclaim-stranded query: in-flight rows with stale claim_at.
CREATE INDEX IF NOT EXISTS amoe_publisher_runs_in_flight_idx
  ON amoe_publisher_runs (claimed_at)
  WHERE finished_at IS NULL;

-- ---------------------------------------------------------------------------
-- Forward-compat add to amoe_zk_submissions: twitter_credit_nullifier_hex
-- ---------------------------------------------------------------------------
--
-- The publisher's projection step needs `twitterCreditNullifier` to
-- compute `walletAddrCommit` for each L1 row (it's an input to the
-- circuit's commitment). We stamp it on `amoe_zk_submissions` at
-- prove-time so the projector can join `(signup_id, spend_ref_id)` →
-- `(wallet_address, twitter_credit_nullifier_hex)` without re-deriving
-- from the user's twitter handle (which is not persisted).
--
-- Nullable: pre-PR-5b rows do not have this column populated, and the
-- projector skips L0 rows whose lookup returns null (see
-- `defaultLookupBurnContext`). The 'pending' → 'proven' transition
-- writes this column going forward.
ALTER TABLE amoe_zk_submissions
  ADD COLUMN IF NOT EXISTS twitter_credit_nullifier_hex TEXT;

-- Index for the projector's lookup (signup_id + spend_ref_id is
-- already in the natural ordering of the table; this index is for
-- the predicate filter only).
CREATE INDEX IF NOT EXISTS amoe_zk_submissions_signup_spend_nullifier_idx
  ON amoe_zk_submissions (signup_id, spend_ref_id)
  WHERE twitter_credit_nullifier_hex IS NOT NULL;
