import { getAddress } from 'viem'

import { createAgentWallet } from './privyWalletApi.js'
import { getDb, isDbConfigured } from './postgres.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let creatorAgentWalletsEnsured = false

export async function ensureCreatorAgentWalletsSchema(db: Db): Promise<void> {
  if (creatorAgentWalletsEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_agent_wallets (
        coin_address TEXT PRIMARY KEY,
        agent_wallet_id TEXT NOT NULL,
        agent_wallet_address TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    creatorAgentWalletsEnsured = true
  } catch (err) {
    creatorAgentWalletsEnsured = false
    throw err
  }
}

export async function getOrCreateCreatorAgentWallet(params: {
  creatorToken: `0x${string}`
}): Promise<{ walletId: string; address: `0x${string}` }> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = (await getDb()) as unknown as Db | null
  if (!db) throw new Error('db_not_configured')
  await ensureCreatorAgentWalletsSchema(db)

  const coin = getAddress(params.creatorToken).toLowerCase()

  // Fast path: already provisioned.
  const existing = await db.sql`
    SELECT agent_wallet_id, agent_wallet_address
    FROM creator_agent_wallets
    WHERE coin_address = ${coin}
    LIMIT 1;
  `
  if (existing.rows && existing.rows.length > 0) {
    const row: any = existing.rows[0]
    const walletId = String(row.agent_wallet_id ?? '').trim()
    const addrRaw = String(row.agent_wallet_address ?? '').trim()
    const address = getAddress(addrRaw).toLowerCase() as `0x${string}`
    if (walletId && address) return { walletId, address }
  }

  // Create (idempotent at Privy layer), then persist.
  const created = await createAgentWallet({ idempotencyKey: `creator-agent:${coin}` })
  const address = getAddress(created.address).toLowerCase() as `0x${string}`
  const walletId = String(created.walletId).trim()
  if (!walletId) throw new Error('privy_wallet_id_missing')

  await db.sql`
    INSERT INTO creator_agent_wallets (
      coin_address,
      agent_wallet_id,
      agent_wallet_address,
      created_at,
      updated_at
    )
    VALUES (
      ${coin},
      ${walletId},
      ${address},
      NOW(),
      NOW()
    )
    ON CONFLICT (coin_address)
    DO UPDATE SET
      agent_wallet_id = EXCLUDED.agent_wallet_id,
      agent_wallet_address = EXCLUDED.agent_wallet_address,
      updated_at = NOW();
  `

  return { walletId, address }
}

