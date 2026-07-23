// AMOE wallet allowlist publisher — build + broadcast `setAllowlistRoot`.

import { hostname as osHostname } from 'node:os'
import { randomUUID } from 'node:crypto'

import { getDb } from '../db/postgres.js'
import {
  buildAmoeAllowlistSnapshot,
  type AmoeAllowlistBuilderDb,
} from './amoeAllowlistSnapshotBuilder.js'
import {
  readAmoeLedgerPublisherBundlerUrl,
  readAmoeLedgerPublisherOwnerAddress,
  readAmoeLedgerPublisherPrivyWalletId,
  readAmoeLedgerPublisherSmartWallet,
  readBaseRpcUrlForPublisher,
} from './amoeLedgerPublisher.js'
import { requireAllowlistPublisherMatchesSender } from './amoePublisherRoleGuard.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

declare const process: { env: Record<string, string | undefined> }

const SET_ALLOWLIST_ROOT_ABI = [
  {
    type: 'function',
    name: 'setAllowlistRoot',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epoch', type: 'uint64' },
      { name: 'root', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

export function isAmoeAllowlistPublisherEnabled(): boolean {
  return String(process.env.AMOE_ALLOWLIST_PUBLISHER_ENABLED ?? '').trim() === '1'
}

export function readAmoeAllowlistPublisherPrivateKey(): `0x${string}` | null {
  // Prefer a dedicated allowlist signer; fall back to ledger/relay owner keys
  // so ops can enable AMOE_ALLOWLIST_PUBLISHER_ENABLED without duplicating
  // secrets when the same EOA is router.allowlistPublisher on-chain.
  const candidates = [
    process.env.AMOE_ALLOWLIST_PUBLISHER_PRIVATE_KEY,
    process.env.AMOE_LEDGER_PUBLISHER_PRIVATE_KEY,
    process.env.LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY,
  ]
  for (const raw of candidates) {
    const trimmed = String(raw ?? '').trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
      return trimmed as `0x${string}`
    }
  }
  return null
}

export function readAllowlistPublisherClaimedBy(): string {
  const explicit = String(process.env.AMOE_ALLOWLIST_PUBLISHER_POD_ID ?? '').trim()
  if (explicit.length > 0) return explicit.slice(0, 200)
  try {
    return `allowlist-${osHostname()}`.slice(0, 200)
  } catch {
    return 'allowlist-unknown'
  }
}

export async function requireAllowlistPublisherDb(): Promise<AmoeAllowlistBuilderDb> {
  const db = await getDb()
  if (!db) throw new AmoeServerError('amoe_db_unavailable')
  return db as unknown as AmoeAllowlistBuilderDb
}

export async function defaultBroadcastSetAllowlistRoot(args: {
  lotteryAmoeRouter: `0x${string}`
  epoch: bigint
  rootHex: `0x${string}`
}): Promise<{ txHash: `0x${string}` }> {
  const [{ createPublicClient, createWalletClient, encodeFunctionData, http }, { base }, { privateKeyToAccount }] =
    await Promise.all([
      import('viem'),
      import('viem/chains'),
      import('viem/accounts'),
    ])

  const callData = encodeFunctionData({
    abi: SET_ALLOWLIST_ROOT_ABI,
    functionName: 'setAllowlistRoot',
    args: [args.epoch, args.rootHex],
  })

  const rpc = readBaseRpcUrlForPublisher()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 30_000 }),
  })

  // Production router.allowlistPublisher is PROTOCOL_CSW — mirror the
  // ledger publisher's Privy 4337 path before falling back to a direct EOA.
  const smartWallet = readAmoeLedgerPublisherSmartWallet()
  const bundlerUrl = readAmoeLedgerPublisherBundlerUrl()
  const privyWalletId = readAmoeLedgerPublisherPrivyWalletId()
  const expectedOwnerAddress = readAmoeLedgerPublisherOwnerAddress()
  if (smartWallet && bundlerUrl && privyWalletId && expectedOwnerAddress) {
    await requireAllowlistPublisherMatchesSender({
      publicClient,
      lotteryAmoeRouter: args.lotteryAmoeRouter,
      expectedSender: smartWallet,
    })
    const {
      resolvePrivyCoinbaseSmartWalletOwnerContext,
      sendPrivyCoinbaseSmartWalletUserOperation,
    } = await import('../wallet/privyCoinbaseSmartWallet.js')
    const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
      publicClient,
      walletId: privyWalletId,
      smartWallet,
      expectedOwnerAddress,
      maxScan: 512,
    })
    const userOpResult = await sendPrivyCoinbaseSmartWalletUserOperation({
      publicClient,
      bundlerUrl,
      walletId: privyWalletId,
      smartWallet,
      ownerAddress: ownerContext.ownerAddress,
      ownerIndex: ownerContext.ownerIndex,
      calls: [{ to: args.lotteryAmoeRouter, value: 0n, data: callData }],
      simulate: false,
    })
    return { txHash: userOpResult.txHash }
  }

  const pk = readAmoeAllowlistPublisherPrivateKey()
  if (!pk) throw new Error('no_allowlist_publisher_key_configured')

  const account = privateKeyToAccount(pk)
  await requireAllowlistPublisherMatchesSender({
    publicClient,
    lotteryAmoeRouter: args.lotteryAmoeRouter,
    expectedSender: account.address,
  })

  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(rpc, { timeout: 30_000 }),
  })

  const hash = await wallet.sendTransaction({
    chain: base,
    to: args.lotteryAmoeRouter,
    data: callData,
    value: 0n,
  })
  return { txHash: hash }
}

export type PublishAllowlistOutcome =
  | { kind: 'finished'; epoch: bigint; rootHex: `0x${string}`; txHash: `0x${string}` }
  | { kind: 'finished_no_op'; epoch: bigint }
  | { kind: 'no_publisher_key_configured' }
  | { kind: 'already_confirmed'; epoch: bigint }

export async function publishAllowlistEpoch(args: {
  db: AmoeAllowlistBuilderDb
  epoch: bigint
  lotteryAmoeRouter: `0x${string}`
  publisherVersion: string
  broadcast?: typeof defaultBroadcastSetAllowlistRoot
}): Promise<PublishAllowlistOutcome> {
  const broadcast = args.broadcast ?? defaultBroadcastSetAllowlistRoot

  const confirmed = await args.db.sql`
    SELECT epoch, root_hex, publish_confirmed_at
    FROM amoe_wallet_allowlist_snapshots
    WHERE epoch = ${args.epoch.toString()}::bigint
      AND publish_confirmed_at IS NOT NULL
    LIMIT 1
  `
  if ((confirmed.rows ?? []).length > 0) {
    return { kind: 'already_confirmed', epoch: args.epoch }
  }

  let rootHex: `0x${string}`
  const built = await args.db.sql`
    SELECT root_hex, publish_tx_hash FROM amoe_wallet_allowlist_snapshots
    WHERE epoch = ${args.epoch.toString()}::bigint LIMIT 1
  `
  const builtRow = (built.rows ?? [])[0] as { root_hex?: string; publish_tx_hash?: string | null } | undefined
  if (!builtRow?.root_hex) {
    const runId = randomUUID()
    try {
      const result = await buildAmoeAllowlistSnapshot({
        db: args.db,
        epoch: args.epoch,
        publisherRunId: runId,
        publisherVersion: args.publisherVersion,
      })
      rootHex = result.rootHex as `0x${string}`
      if (result.leafCount === 0) {
        return { kind: 'finished_no_op', epoch: args.epoch }
      }
    } catch (err) {
      if (err instanceof AmoeServerError && err.message === 'amoe_allowlist_snapshot_already_built') {
        const reread = await args.db.sql`
          SELECT root_hex FROM amoe_wallet_allowlist_snapshots
          WHERE epoch = ${args.epoch.toString()}::bigint LIMIT 1
        `
        const row = (reread.rows ?? [])[0] as { root_hex?: string } | undefined
        if (!row?.root_hex) throw err
        rootHex = row.root_hex as `0x${string}`
      } else {
        throw err
      }
    }
  } else {
    rootHex = builtRow.root_hex as `0x${string}`
    if (builtRow.publish_tx_hash) {
      return {
        kind: 'finished',
        epoch: args.epoch,
        rootHex,
        txHash: builtRow.publish_tx_hash as `0x${string}`,
      }
    }
  }

  if (rootHex === '0x' + '0'.repeat(64)) {
    return { kind: 'finished_no_op', epoch: args.epoch }
  }

  try {
    const { txHash } = await broadcast({
      lotteryAmoeRouter: args.lotteryAmoeRouter,
      epoch: args.epoch,
      rootHex,
    })
    await args.db.sql`
      UPDATE amoe_wallet_allowlist_snapshots
      SET publish_tx_hash = ${txHash}
      WHERE epoch = ${args.epoch.toString()}::bigint AND publish_tx_hash IS NULL
    `
    return { kind: 'finished', epoch: args.epoch, rootHex, txHash }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('no_allowlist_publisher_key_configured')) {
      return { kind: 'no_publisher_key_configured' }
    }
    throw err
  }
}
