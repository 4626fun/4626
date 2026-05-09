// SPDX-License-Identifier: MIT
//
// Pure helper for the Zora CSW scan cron handler. Wraps the
// `eth_getLogs` ZoraSmartWalletCreated lookup and returns a typed
// shape that the handler can blindly upsert.
//
// SOURCE-OF-TRUTH NOTE
// ====================
// The CLI in `indexer/src/indexCreations.ts` is still the canonical
// implementation for full-history backfills (it has windowed forward
// + backwards scanners). This module is intentionally smaller — only
// what the serverless cron needs: a single bounded window per tick.
// We copy the constants and ABI directly so the cron has no runtime
// dependency on the indexer/ workspace; if the CLI's wire shape ever
// changes, this file is the second place to update.

import {
  decodeEventLog,
  getAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

declare const process: { env: Record<string, string | undefined> }

/**
 * Zora's account-manager proxy on Base mainnet — same address used by
 * `indexer/src/constants.ts`. Re-declared here so the frontend has no
 * runtime dep on the indexer/ workspace.
 */
export const ZORA_ACCOUNT_MANAGER_ADDRESS: Address =
  '0x0Ba958A449701907302e28F5955fa9d16dDC45c3'

/**
 * Block confirmations required before a log is considered safe to
 * persist. Base produces ~2s blocks and finality (post-Bedrock) is
 * effectively reached well before 12 confs, but we keep a buffer to
 * absorb minor reorgs around L1 batch posting without re-indexing.
 */
export const SAFETY_CONFIRMATIONS = 12n

/** Default per-tick window cap if `INDEXER_GETLOGS_WINDOW` is unset. */
export const DEFAULT_GETLOGS_WINDOW = 10_000n

const ZORA_ACCOUNT_MANAGER_ABI = [
  {
    type: 'event',
    name: 'ZoraSmartWalletCreated',
    inputs: [
      { name: 'smartWallet', type: 'address', indexed: true },
      { name: 'baseOwner', type: 'address', indexed: true },
      { name: 'owners', type: 'address[]', indexed: false },
      { name: 'nonce', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi

const ZORA_SMART_WALLET_CREATED_EVENT = {
  type: 'event',
  name: 'ZoraSmartWalletCreated',
  inputs: [
    { name: 'smartWallet', type: 'address', indexed: true },
    { name: 'baseOwner', type: 'address', indexed: true },
    { name: 'owners', type: 'address[]', indexed: false },
    { name: 'nonce', type: 'uint256', indexed: false },
  ],
} as const

export type CswCreation = {
  cswAddress: Address
  baseOwner: Address
  initialOwners: Address[]
  nonce: bigint
  blockNumber: bigint
  txHash: Hex
  logIndex: number
}

type ZoraSmartWalletCreatedArgs = {
  smartWallet: Address
  baseOwner: Address
  owners: readonly Address[]
  nonce: bigint
}

function isZoraSmartWalletCreatedArgs(
  value: readonly unknown[] | Record<string, unknown> | undefined,
): value is ZoraSmartWalletCreatedArgs {
  if (!value || Array.isArray(value)) return false
  const asRecord = value as Record<string, unknown>
  const smartWallet = asRecord.smartWallet
  const baseOwner = asRecord.baseOwner
  const owners = asRecord.owners
  const nonce = asRecord.nonce
  return (
    typeof smartWallet === 'string' &&
    typeof baseOwner === 'string' &&
    Array.isArray(owners) &&
    owners.every((owner) => typeof owner === 'string') &&
    typeof nonce === 'bigint'
  )
}

export function readGetLogsWindow(): bigint {
  const raw = String(process.env.INDEXER_GETLOGS_WINDOW ?? '').trim()
  if (!raw) return DEFAULT_GETLOGS_WINDOW
  // Guard against non-integer strings (e.g. 'abc', '10_000', '1.5') —
  // BigInt() throws SyntaxError on those, which would escape the scan
  // cron handler (the call site is outside its try/catch) and turn a
  // bad env value into a 500 that breaks the schedule instead of a
  // 200 tick: 'errored' that stays observable. Validate first, then
  // parse. Matches the fallback behaviour of readEnrichBudget /
  // readRpcConcurrency in cronConfig.ts.
  if (!/^\d+$/.test(raw)) return DEFAULT_GETLOGS_WINDOW
  const parsed = BigInt(raw)
  if (parsed <= 0n) return DEFAULT_GETLOGS_WINDOW
  return parsed
}

/**
 * Fetch a single block window and decode the events. Failures bubble
 * up — the caller (cron handler) catches them and surfaces as a
 * `tick: 'errored'` so the schedule keeps ticking.
 */
export async function fetchCreationsWindow(
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<CswCreation[]> {
  const logs = await client.getLogs({
    address: ZORA_ACCOUNT_MANAGER_ADDRESS,
    event: ZORA_SMART_WALLET_CREATED_EVENT,
    fromBlock,
    toBlock,
  })

  const out: CswCreation[] = []
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ZORA_ACCOUNT_MANAGER_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName !== 'ZoraSmartWalletCreated') continue
      if (!isZoraSmartWalletCreatedArgs(decoded.args)) continue
      const args = decoded.args
      out.push({
        cswAddress: getAddress(args.smartWallet),
        baseOwner: getAddress(args.baseOwner),
        initialOwners: args.owners.map((a) => getAddress(a)),
        nonce: args.nonce,
        blockNumber: log.blockNumber ?? 0n,
        txHash: (log.transactionHash ?? '0x') as Hex,
        logIndex: log.logIndex ?? 0,
      })
    } catch (err) {
      // Best-effort decoding — a single malformed log shouldn't poison
      // the whole window. Surface in stderr so it shows up in Vercel
      // function logs.
      console.warn(
        `[zora-csw-scan] failed to decode log at ${log.transactionHash}:${log.logIndex}`,
        err,
      )
    }
  }
  return out
}

/**
 * Compute the [fromBlock, toBlock] pair for a single scan tick.
 *
 * - `tipBlock` is the current chain head.
 * - `lastScannedBlock` is the high-water mark from the state row.
 *
 * `toBlock = tipBlock - SAFETY_CONFIRMATIONS` so we only persist
 * blocks that are unlikely to reorg. `fromBlock = lastScannedBlock + 1`,
 * capped to `fromBlock + windowSize - 1` so we never ask the bundler/
 * RPC for more than the configured window.
 *
 * Returns `null` if there's no work — either we're already caught up
 * to the safety horizon, or the chain hasn't advanced past the
 * checkpoint.
 */
export function planScanWindow(args: {
  tipBlock: bigint
  lastScannedBlock: bigint
  windowSize: bigint
  safetyConfirmations?: bigint
}): { fromBlock: bigint; toBlock: bigint } | null {
  const safety = args.safetyConfirmations ?? SAFETY_CONFIRMATIONS
  if (args.tipBlock <= safety) return null
  const safeTip = args.tipBlock - safety
  if (safeTip <= args.lastScannedBlock) return null
  const fromBlock = args.lastScannedBlock + 1n
  const naiveTo = fromBlock + args.windowSize - 1n
  const toBlock = naiveTo < safeTip ? naiveTo : safeTip
  return { fromBlock, toBlock }
}
