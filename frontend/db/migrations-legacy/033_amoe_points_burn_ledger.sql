-- Migration: AMOE points-burn ledger source-of-truth (L1 + L2).
--
-- Introduces the two materialized layers that sit between the operational
-- `points` table (L0) and the on-chain `pointsLedgerRootOf` mapping (L3):
--
--   * `amoe_points_burn_ledger` (L1) — one row per AMOE burn, projected
--     from `points` rows with `source = 'amoe_entry_spend'`. Pins the
--     witness-derived field elements (signup_id_hash, spend_ref_id_hash,
--     points_burned_as_usd, wallet_addr_commit, leaf_hash) at projection
--     time so a salt rotation can never silently corrupt historical
--     proofs. Mutated only by the publisher cron (PR 5b); never
--     hand-edited. Idempotent via UNIQUE(source_points_id).
--
--   * `amoe_points_burn_ledger_snapshots` (L2) — one row per epoch, frozen
--     at epoch close. Holds the Merkle root + the sparse-tree blob that
--     `amoeLedgerSnapshotPg` returns to the prover. Three states tracked
--     by `publish_tx_hash` / `publish_confirmed_at` (built / broadcast /
--     confirmed); only PR 5b's cron may transition states.
--
-- Design doc: `docs/security/amoe-points-burn-ledger-sot.md`.
--
-- This migration is byte-for-byte identical to its sibling:
--   `supabase/migrations/20260429010000_amoe_points_burn_ledger.sql`.
-- Keep them in lockstep — diverging the two will trip the docs-drift CI.

-- ---------------------------------------------------------------------------
-- L1: derived AMOE burn ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amoe_points_burn_ledger (
  -- Identity (deterministic from L0 points row)
  signup_id                  BIGINT        NOT NULL,
  spend_ref_id               TEXT          NOT NULL,
  points_burned              BIGINT        NOT NULL CHECK (points_burned BETWEEN 100 AND 1000000),

  -- Epoch assignment (set by publisher at projection time)
  epoch                      BIGINT        NOT NULL CHECK (epoch >= 0),

  -- Wallet binding (the wallet the user submitted from at debit time)
  wallet_address             TEXT          NOT NULL,
  twitter_credit_nullifier_hex TEXT        NOT NULL,

  -- Witness-derived field elements (computed at projection time, pinned)
  signup_id_hash_hex         TEXT          NOT NULL,
  spend_ref_id_hash_hex      TEXT          NOT NULL,
  points_burned_as_usd       NUMERIC(78,0) NOT NULL CHECK (points_burned_as_usd > 0),
  wallet_addr_commit_hex     TEXT          NOT NULL,

  -- Leaf hash (the Poseidon5 of the five field elements above)
  leaf_hash_hex              TEXT          NOT NULL,

  -- Provenance
  source_points_id           BIGINT        NOT NULL,
  projected_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  publisher_run_id           UUID          NOT NULL,

  PRIMARY KEY (signup_id, spend_ref_id, epoch),
  CONSTRAINT amoe_points_burn_ledger_source_unique UNIQUE (source_points_id),
  CONSTRAINT amoe_points_burn_ledger_leaf_unique   UNIQUE (leaf_hash_hex)
);

-- Used by the publisher to scan an epoch for projection / building.
CREATE INDEX IF NOT EXISTS amoe_points_burn_ledger_epoch_idx
  ON amoe_points_burn_ledger (epoch, signup_id);

-- Used by the witness assembler to find a leaf's deterministic position
-- within its epoch (= leaf index in the Merkle tree). Ordering must match
-- the publisher's leaf-assignment policy in
-- `frontend/server/_lib/lottery/amoeLedgerSnapshotBuilder.ts`.
CREATE INDEX IF NOT EXISTS amoe_points_burn_ledger_epoch_position_idx
  ON amoe_points_burn_ledger (epoch, projected_at, signup_id, spend_ref_id);

-- ---------------------------------------------------------------------------
-- L2: Merkle snapshot per epoch
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amoe_points_burn_ledger_snapshots (
  epoch                      BIGINT        PRIMARY KEY CHECK (epoch >= 0),

  -- Tree summary
  leaf_count                 BIGINT        NOT NULL CHECK (leaf_count >= 0),
  root_hex                   TEXT          NOT NULL,
  tree_depth                 SMALLINT      NOT NULL DEFAULT 20 CHECK (tree_depth = 20),

  -- Sparse-tree storage (compatible with amoeMerkleTree.ts).
  -- Encoded as JSONB:
  --   {
  --     "nodes":  [[level, indexAtLevel, value_hex], ...],
  --     "leaves": [[leafIndex, value_hex], ...]
  --   }
  -- Only materialized levels for non-zero subtrees are stored.
  tree_blob                  JSONB         NOT NULL,

  -- Publication state machine
  built_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  publish_tx_hash            TEXT,
  publish_block_number       BIGINT,
  publish_confirmed_at       TIMESTAMPTZ,

  -- Audit
  publisher_run_id           UUID          NOT NULL,
  publisher_version          TEXT          NOT NULL,

  -- Once a snapshot is published, the three publish_* fields move together.
  -- Either all NULL (state 1: built, not yet broadcast), or tx_hash set
  -- with NULL confirm (state 2: broadcast, polling), or all NOT NULL
  -- (state 3: confirmed and frozen).
  CONSTRAINT amoe_points_burn_ledger_snapshots_publish_consistency CHECK (
    (publish_tx_hash IS NULL AND publish_block_number IS NULL AND publish_confirmed_at IS NULL)
    OR
    (publish_tx_hash IS NOT NULL AND publish_block_number IS NULL AND publish_confirmed_at IS NULL)
    OR
    (publish_tx_hash IS NOT NULL AND publish_block_number IS NOT NULL AND publish_confirmed_at IS NOT NULL)
  )
);

-- Partial index used by the publisher cron to find epochs that need
-- broadcast or confirmation polling.
CREATE INDEX IF NOT EXISTS amoe_points_burn_ledger_snapshots_pending_idx
  ON amoe_points_burn_ledger_snapshots (epoch)
  WHERE publish_confirmed_at IS NULL;
