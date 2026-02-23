import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { base, mainnet } from 'viem/chains'

import { getDb } from '../server/_lib/postgres.js'
import { ensureAgentSubdomainsSchema, isReservedSubdomainLabel, normalizeSubdomainLabel } from '../server/_lib/agentSubdomains.js'

declare const process: { env: Record<string, string | undefined> }

const SUBDOMAIN_REGISTERED_EVENT = parseAbiItem(
  'event SubdomainRegistered(uint256 indexed parentId,uint256 indexed subdomainId,address indexed buyer,address to,address feeToken,uint256 price,string label)',
)

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

function env(key: string, fallback = ''): string {
  return String(process.env[key] ?? fallback).trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asPositiveInt(value: string, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function isAddressLike(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function resolveRpcUrl(chainId: number): string {
  const explicit = env('SUBDOMAIN_RPC_URL')
  if (explicit) return explicit
  if (chainId === 1) {
    return env('ETH_LOGS_RPC_URL') || env('ETH_RPC_URL') || 'https://ethereum-rpc.publicnode.com'
  }
  if (chainId === 8453) {
    return env('BASE_LOGS_RPC_URL') || env('BASE_RPC_URL') || 'https://mainnet.base.org'
  }
  return env('BASE_LOGS_RPC_URL') || env('BASE_RPC_URL') || 'https://mainnet.base.org'
}

async function ensureIndexerStateSchema(db: Db): Promise<void> {
  await db.sql`
    CREATE TABLE IF NOT EXISTS agent_subdomain_indexer_state (
      id INTEGER PRIMARY KEY,
      last_scanned_block BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`
    INSERT INTO agent_subdomain_indexer_state (id, last_scanned_block)
    VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
  `
}

async function readCursor(db: Db, fallbackStartBlock: bigint): Promise<bigint> {
  const result = await db.sql`
    SELECT last_scanned_block
    FROM agent_subdomain_indexer_state
    WHERE id = 1
    LIMIT 1;
  `
  const raw = result.rows?.[0]?.last_scanned_block
  if (raw == null) return fallbackStartBlock
  try {
    const parsed = BigInt(String(raw))
    return parsed > 0n ? parsed : fallbackStartBlock
  } catch {
    return fallbackStartBlock
  }
}

async function writeCursor(db: Db, block: bigint): Promise<void> {
  await db.sql`
    UPDATE agent_subdomain_indexer_state
    SET last_scanned_block = ${block.toString()}, updated_at = NOW()
    WHERE id = 1;
  `
}

async function postUpsert(params: {
  apiUrl: string
  secret: string
  body: Record<string, unknown>
}): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const res = await fetch(params.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.secret}`,
    },
    body: JSON.stringify(params.body),
  })
  const text = await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, bodyText: text.slice(0, 600) }
}

async function run(): Promise<void> {
  const registrarAddressRaw = env('SUBDOMAIN_REGISTRAR_ADDRESS')
  const upsertApiUrl = env('SUBDOMAIN_INDEXER_API_URL', 'https://app.4626.fun/api/agents/subdomains/upsert')
  const indexerSecret = env('SUBDOMAIN_INDEXER_SECRET')
  const parentDomain = env('SUBDOMAIN_PARENT_DOMAIN', '4626.wei')
  const chainId = asPositiveInt(env('SUBDOMAIN_CHAIN_ID', '1'), 1)
  const rpcUrl = resolveRpcUrl(chainId)
  const pollMs = asPositiveInt(env('SUBDOMAIN_INDEXER_POLL_MS', '12000'), 12000)
  const chunkSize = asPositiveInt(env('SUBDOMAIN_INDEXER_CHUNK_SIZE', '2000'), 2000)
  const startBlock = BigInt(asPositiveInt(env('SUBDOMAIN_START_BLOCK', '0'), 0))

  if (!isAddressLike(registrarAddressRaw)) {
    throw new Error('SUBDOMAIN_REGISTRAR_ADDRESS is missing or invalid')
  }
  if (!indexerSecret) {
    throw new Error('SUBDOMAIN_INDEXER_SECRET is missing')
  }

  const db = await getDb()
  if (!db) {
    throw new Error('DB unavailable (DATABASE_URL or POSTGRES_URL required)')
  }
  await ensureAgentSubdomainsSchema(db as any)
  await ensureIndexerStateSchema(db as any)

  const chain = chainId === 8453 ? base : chainId === 1 ? mainnet : undefined
  const publicClient = createPublicClient({
    ...(chain ? { chain } : {}),
    transport: http(rpcUrl, { timeout: 20_000 }),
  })

  let fromBlock = await readCursor(db as any, startBlock)
  if (fromBlock === 0n) {
    fromBlock = await publicClient.getBlockNumber()
  }

  process.stdout.write(
    `[subdomain-indexer] start registrar=${registrarAddressRaw.toLowerCase()} fromBlock=${fromBlock} chainId=${chainId} pollMs=${pollMs}\n`,
  )

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const latest = await publicClient.getBlockNumber()
      if (fromBlock > latest) {
        await sleep(pollMs)
        continue
      }
      const toBlock = fromBlock + BigInt(chunkSize) - 1n > latest ? latest : fromBlock + BigInt(chunkSize) - 1n

      const logs = await publicClient.getLogs({
        address: registrarAddressRaw,
        event: SUBDOMAIN_REGISTERED_EVENT,
        fromBlock,
        toBlock,
      })

      let hardFailure = false
      for (const log of logs) {
        const args = log.args as {
          parentId?: bigint
          subdomainId?: bigint
          buyer?: Address
          to?: Address
          feeToken?: Address
          price?: bigint
          label?: string
        }
        const label = normalizeSubdomainLabel(String(args.label ?? ''))
        if (!label || isReservedSubdomainLabel(label)) {
          process.stdout.write(
            `[subdomain-indexer] skipped invalid/reserved label tx=${String(log.transactionHash ?? '')} label=${String(args.label ?? '')}\n`,
          )
          continue
        }
        const ownerAddress = String(args.to ?? args.buyer ?? '').toLowerCase()
        if (!isAddressLike(ownerAddress)) continue

        const payload = {
          label,
          parentId: args.parentId != null ? args.parentId.toString() : undefined,
          parentDomain,
          subdomainId: args.subdomainId != null ? args.subdomainId.toString() : null,
          ownerAddress,
          chainId,
          source: 'indexer',
          txHash: log.transactionHash ?? null,
          blockNumber: log.blockNumber != null ? log.blockNumber.toString() : null,
          metadata: {
            event: 'SubdomainRegistered',
            buyer: args.buyer ?? null,
            to: args.to ?? null,
            feeToken: args.feeToken ?? null,
            price: args.price != null ? args.price.toString() : null,
            txHash: log.transactionHash ?? null,
            blockNumber: log.blockNumber != null ? log.blockNumber.toString() : null,
            indexedAt: new Date().toISOString(),
          },
        } as const
        const upsert = await postUpsert({ apiUrl: upsertApiUrl, secret: indexerSecret, body: payload })
        if (!upsert.ok) {
          if (upsert.status >= 400 && upsert.status < 500) {
            process.stderr.write(
              `[subdomain-indexer] skipped client error status=${upsert.status} tx=${String(log.transactionHash ?? '')} label=${label} body=${upsert.bodyText}\n`,
            )
            continue
          }
          process.stderr.write(
            `[subdomain-indexer] upsert server error status=${upsert.status} tx=${String(log.transactionHash ?? '')} label=${label} body=${upsert.bodyText}\n`,
          )
          hardFailure = true
          break
        }
      }

      if (hardFailure) {
        throw new Error(`upsert_failed_range_${fromBlock.toString()}_${toBlock.toString()}`)
      }

      await writeCursor(db as any, toBlock + 1n)
      if (logs.length > 0) {
        process.stdout.write(
          `[subdomain-indexer] processed logs=${logs.length} range=${fromBlock}-${toBlock}\n`,
        )
      }
      fromBlock = toBlock + 1n
      await sleep(pollMs)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[subdomain-indexer] loop error: ${message}\n`)
      await sleep(Math.max(pollMs, 15_000))
    }
  }
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[subdomain-indexer] fatal: ${message}\n`)
  process.exit(1)
})
