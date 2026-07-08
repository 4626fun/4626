import type { DbPool } from '../db/postgres.js'

export type LotteryEntrySource = 'amoe' | 'swap' | 'unknown'

export type LotteryEntrySourceRow = {
  transactionHash: string
  requestId: string
  entrySource?: LotteryEntrySource
}

const ADDR_RE = /^0x[a-f0-9]{40}$/
const TX_HASH_RE = /^0x[a-f0-9]{64}$/

function normalizeAddress(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toLowerCase()
  if (!ADDR_RE.test(raw)) return null
  return raw
}

function normalizeTxHash(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toLowerCase()
  if (!TX_HASH_RE.test(raw)) return null
  return raw
}

/** Addresses that may appear as tx `from`/`to` on AMOE submission txs. */
export function readKnownAmoeCallerAddresses(): Set<string> {
  const addresses = new Set<string>()
  for (const key of [
    'LOTTERY_AMOE_ROUTER',
    'LOTTERY_AMOE_RELAY_SMART_WALLET',
    'LOTTERY_AMOE_RELAY_OWNER',
  ]) {
    const normalized = normalizeAddress(process.env[key])
    if (normalized) addresses.add(normalized)
  }
  return addresses
}

let processAmoeEntrySelector: string | null = null

async function getProcessAmoeEntrySelector(): Promise<string> {
  if (processAmoeEntrySelector) return processAmoeEntrySelector
  const { encodeFunctionData } = await import('viem')
  processAmoeEntrySelector = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'processAmoeEntry',
        inputs: [
          { name: 'buyer', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'pointsBurnedAsUSD', type: 'uint256' },
        ],
        outputs: [{ name: 'entryId', type: 'uint256' }],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'processAmoeEntry',
    args: [
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000001',
      1n,
    ],
  }).slice(0, 10)
  return processAmoeEntrySelector
}

export async function fetchAmoeSubmissionMatches(
  db: DbPool,
  events: LotteryEntrySourceRow[],
): Promise<{ txHashes: Set<string>; requestIds: Set<string> }> {
  const txHashes = new Set<string>()
  const requestIds = new Set<string>()

  if (events.length === 0) {
    return { txHashes, requestIds }
  }

  const txHashList = [...new Set(
    events
      .map((event) => normalizeTxHash(event.transactionHash))
      .filter((hash): hash is string => hash != null),
  )]
  const requestIdList = [...new Set(
    events
      .map((event) => String(event.requestId ?? '').trim())
      .filter((id) => id.length > 0 && id !== '0'),
  )]

  if (txHashList.length === 0 && requestIdList.length === 0) {
    return { txHashes, requestIds }
  }

  const result = await db.query?.(
    `
    select distinct
      lower(tx_hash) as tx_hash,
      manager_entry_id::text as manager_entry_id
    from amoe_zk_submissions
    where (
      ($1::text[] <> '{}' and lower(tx_hash) = any($1::text[]))
      or ($2::text[] <> '{}' and manager_entry_id::text = any($2::text[]))
    )
    `,
    [txHashList, requestIdList],
  )

  if (!result) {
    throw new Error('Database query API unavailable')
  }

  for (const row of result.rows as Array<{ tx_hash?: string | null; manager_entry_id?: string | null }>) {
    const txHash = normalizeAddress(row.tx_hash)
    if (txHash) txHashes.add(txHash)
    const requestId = String(row.manager_entry_id ?? '').trim()
    if (requestId.length > 0 && requestId !== '0') requestIds.add(requestId)
  }

  return { txHashes, requestIds }
}

export function classifyEntryFromAmoeStore(
  event: LotteryEntrySourceRow,
  matches: { txHashes: Set<string>; requestIds: Set<string> },
): LotteryEntrySource | null {
  const txHash = normalizeTxHash(event.transactionHash)
  if (txHash && matches.txHashes.has(txHash)) return 'amoe'

  const requestId = String(event.requestId ?? '').trim()
  if (requestId.length > 0 && requestId !== '0' && matches.requestIds.has(requestId)) {
    return 'amoe'
  }

  return null
}

export async function classifyEntryFromTransaction(
  event: LotteryEntrySourceRow,
  params: {
    lotteryManager: string
    amoeCallers: Set<string>
    getTransaction: (hash: `0x${string}`) => Promise<{
      from?: string
      to?: string | null
      input?: string
    } | null>
  },
): Promise<LotteryEntrySource> {
  const txHash = normalizeTxHash(event.transactionHash)
  if (!txHash) return 'unknown'

  try {
    const tx = await params.getTransaction(txHash as `0x${string}`)
    if (!tx) return 'unknown'

    const from = normalizeAddress(tx.from)
    const to = normalizeAddress(tx.to)
    const lotteryManager = normalizeAddress(params.lotteryManager)
    const input = String(tx.input ?? '').toLowerCase()

    if (from && params.amoeCallers.has(from)) return 'amoe'
    if (to && params.amoeCallers.has(to)) return 'amoe'

    if (lotteryManager && to === lotteryManager) {
      const selector = await getProcessAmoeEntrySelector()
      const normalizedInput = input.startsWith('0x') ? input : `0x${input}`
      if (normalizedInput.startsWith(selector)) return 'amoe'
    }

    return 'swap'
  } catch {
    return 'unknown'
  }
}

export async function enrichLotteryEntrySources<T extends LotteryEntrySourceRow>(
  db: DbPool | null,
  events: T[],
  params: {
    lotteryManager: string
    getTransaction?: (hash: `0x${string}`) => Promise<{
      from?: string
      to?: string | null
      input?: string
    } | null>
  },
): Promise<Array<T & { entrySource: LotteryEntrySource }>> {
  if (events.length === 0) return []

  const amoeCallers = readKnownAmoeCallerAddresses()
  let storeMatches = { txHashes: new Set<string>(), requestIds: new Set<string>() }

  if (db) {
    try {
      storeMatches = await fetchAmoeSubmissionMatches(db, events)
    } catch (err) {
      console.warn('[lottery/recentEntries] AMOE store lookup failed', err)
    }
  }

  const getTransaction = params.getTransaction ?? null
  const txCache = new Map<string, LotteryEntrySource>()

  const enriched: Array<T & { entrySource: LotteryEntrySource }> = []

  for (const event of events) {
    const fromStore = classifyEntryFromAmoeStore(event, storeMatches)
    if (fromStore) {
      enriched.push({ ...event, entrySource: fromStore })
      continue
    }

    const txHash = normalizeTxHash(event.transactionHash)
    if (txHash && txCache.has(txHash)) {
      enriched.push({ ...event, entrySource: txCache.get(txHash)! })
      continue
    }

    if (getTransaction) {
      const fromTx = await classifyEntryFromTransaction(event, {
        lotteryManager: params.lotteryManager,
        amoeCallers,
        getTransaction,
      })
      if (txHash) txCache.set(txHash, fromTx)
      enriched.push({ ...event, entrySource: fromTx })
      continue
    }

    enriched.push({ ...event, entrySource: 'swap' })
  }

  return enriched
}
