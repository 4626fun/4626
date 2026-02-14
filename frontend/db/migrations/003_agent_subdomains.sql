-- Agent subdomain registry for 4626.wei + web mirror hosts (e.g. *.4626.fun).
-- Stores label ownership, Grove metadata pointers, and Lens identity hints.

CREATE TABLE IF NOT EXISTS agent_subdomains (
  id BIGSERIAL PRIMARY KEY,
  parent_id TEXT NOT NULL,
  parent_domain TEXT NOT NULL,
  full_name TEXT NOT NULL,
  label TEXT NOT NULL,
  fqdn TEXT NOT NULL,
  subdomain_id TEXT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1,
  owner_address TEXT NOT NULL,
  controller_address TEXT NULL,
  metadata_json JSONB NULL,
  metadata_lens_uri TEXT NULL,
  metadata_gateway_url TEXT NULL,
  metadata_storage_key TEXT NULL,
  lens_handle TEXT NULL,
  lens_account_address TEXT NULL,
  lens_owner_address TEXT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  tx_hash TEXT NULL,
  block_number TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_subdomains_parent_label_unique
  ON agent_subdomains (parent_id, label);

CREATE UNIQUE INDEX IF NOT EXISTS agent_subdomains_fqdn_unique
  ON agent_subdomains (fqdn);

CREATE INDEX IF NOT EXISTS agent_subdomains_owner_idx
  ON agent_subdomains (owner_address);

CREATE INDEX IF NOT EXISTS agent_subdomains_lens_owner_idx
  ON agent_subdomains (lens_owner_address);

CREATE INDEX IF NOT EXISTS agent_subdomains_updated_idx
  ON agent_subdomains (updated_at DESC);
