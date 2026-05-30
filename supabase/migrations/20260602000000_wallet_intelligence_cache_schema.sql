-- Wallet intelligence and feedback cache tables.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/wallet/walletIntelligenceCache.ts.

CREATE TABLE IF NOT EXISTS wallet_intelligence_cache (
  address       TEXT NOT NULL,
  chain_ids     TEXT NOT NULL DEFAULT '8453,1',
  hops          INT  NOT NULL DEFAULT 3,
  graph         JSONB NOT NULL,
  grove_uri     TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (address, chain_ids, hops)
);

CREATE INDEX IF NOT EXISTS wallet_intelligence_cache_address_idx ON wallet_intelligence_cache (address);

CREATE TABLE IF NOT EXISTS entity_labels_cache (
  address       TEXT NOT NULL,
  chain_id      INT  NOT NULL DEFAULT 8453,
  labels        JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_known      BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'unknown',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (address, chain_id)
);

CREATE INDEX IF NOT EXISTS entity_labels_cache_address_idx ON entity_labels_cache (address);

CREATE TABLE IF NOT EXISTS feedback_index (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        INT NOT NULL,
  client_address  TEXT NOT NULL,
  feedback_index  INT NOT NULL,
  value           INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_index_agent_client_idx ON feedback_index (agent_id, client_address);

COMMENT ON TABLE wallet_intelligence_cache IS 'Cached wallet graph intelligence data.';
COMMENT ON TABLE entity_labels_cache IS 'Cached labels for addresses (e.g. exchange, contract, etc.).';
COMMENT ON TABLE feedback_index IS 'Per-agent feedback indexing for ranking.';