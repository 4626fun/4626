-- Agent memory tables for the Eliza / XMTP Keepr agent.
-- Extracted from duplicated runtime bootstrap in frontend/server/agents/eliza/runtimeBridge.ts.

CREATE TABLE IF NOT EXISTS agent_message_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  entity_id TEXT,
  role TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  conversation_type TEXT,
  sender_address TEXT,
  content TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_message_memory_conversation_created_idx
  ON agent_message_memory (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_message_memory_agent_conversation_idx
  ON agent_message_memory (agent_id, conversation_id);

CREATE TABLE IF NOT EXISTS episodic_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fact_cards (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT,
  entity TEXT,
  fact TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fact_cards_entity_idx ON fact_cards (entity);
CREATE INDEX IF NOT EXISTS fact_cards_conversation_entity_unique_idx 
  ON fact_cards (conversation_id, entity) 
  WHERE conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_loops (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_loops_conversation_status_idx 
  ON task_loops (conversation_id, status);

CREATE TABLE IF NOT EXISTS grove_chat_manifests (
  conversation_id TEXT PRIMARY KEY,
  chunk_list JSONB NOT NULL,
  root_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS grove_manif_conversation_idx ON grove_chat_manifests (conversation_id);

CREATE TABLE IF NOT EXISTS memory_snapshots (
  conversation_id TEXT PRIMARY KEY,
  snapshot_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_message_memory IS 'Core message memory for the Eliza agent (with optional vector embeddings).';
COMMENT ON TABLE episodic_summaries IS 'Conversation summaries for long-term agent context.';
COMMENT ON TABLE fact_cards IS 'Extracted facts per conversation/entity.';
COMMENT ON TABLE task_loops IS 'Agent task tracking per conversation.';
COMMENT ON TABLE grove_chat_manifests IS 'Merkle-tree style chat manifest for Grove storage.';
COMMENT ON TABLE memory_snapshots IS 'Periodic memory snapshots for the agent.';