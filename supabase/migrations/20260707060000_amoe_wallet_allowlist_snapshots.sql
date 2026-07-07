-- AMOE wallet allowlist snapshots (L2) — one Merkle root per epoch for
-- `LotteryAmoeRouter.setAllowlistRoot`. Mirrors the points-burn ledger
-- snapshot shape; published by `amoeAllowlistPublisher.ts`.

CREATE TABLE IF NOT EXISTS amoe_wallet_allowlist_snapshots (
  epoch                      BIGINT        PRIMARY KEY CHECK (epoch >= 0),
  leaf_count                 BIGINT        NOT NULL CHECK (leaf_count >= 0),
  root_hex                   TEXT          NOT NULL,
  tree_depth                 SMALLINT      NOT NULL DEFAULT 20 CHECK (tree_depth = 20),
  tree_blob                  JSONB         NOT NULL,
  built_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  publish_tx_hash            TEXT,
  publish_block_number       BIGINT,
  publish_confirmed_at       TIMESTAMPTZ,
  publisher_run_id           UUID          NOT NULL,
  publisher_version          TEXT          NOT NULL,
  CONSTRAINT amoe_wallet_allowlist_snapshots_publish_consistency CHECK (
    (publish_tx_hash IS NULL AND publish_block_number IS NULL AND publish_confirmed_at IS NULL)
    OR
    (publish_tx_hash IS NOT NULL AND publish_block_number IS NULL AND publish_confirmed_at IS NULL)
    OR
    (publish_tx_hash IS NOT NULL AND publish_block_number IS NOT NULL AND publish_confirmed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS amoe_wallet_allowlist_snapshots_pending_idx
  ON amoe_wallet_allowlist_snapshots (epoch)
  WHERE publish_confirmed_at IS NULL;

COMMENT ON TABLE amoe_wallet_allowlist_snapshots IS
  'Per-epoch Poseidon Merkle snapshot of AMOE-eligible wallets (leaf = Poseidon(wallet, epoch)).';
