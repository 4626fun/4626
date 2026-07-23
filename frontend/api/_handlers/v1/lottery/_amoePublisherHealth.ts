// SPDX-License-Identifier: MIT
//
// Read-only AMOE publisher health — `GET /api/v1/lottery/amoe/publisher-health`.
// Cron-auth only. No side effects (no UserOps, no DB writes).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, http, isAddressEqual, type Address } from 'viem'
import { base } from 'viem/chains'

import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  computeAmoeEpoch,
  isAmoeZkSubmitEnabled,
  readLotteryAmoeRouterAddress,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'
import {
  isAmoeLedgerPublisherEnabled,
  readAmoeLedgerPublisherSmartWallet,
  readBaseRpcUrlForPublisher,
  requirePublisherDb,
} from '../../../../server/_lib/lottery/amoeLedgerPublisher.js'
import { isAmoeAllowlistPublisherEnabled } from '../../../../server/_lib/lottery/amoeAllowlistPublisher.js'
import {
  AMOE_ZERO_ROOT,
  isZeroRoot,
  normalizeRootHex,
  readAllowlistRootOf,
  readPointsLedgerRootOf,
} from '../../../../server/_lib/lottery/amoePublisherRoleGuard.js'

declare const process: { env: Record<string, string | undefined> }

const ALLOWLIST_PUBLISHER_ABI = [
  {
    type: 'function',
    name: 'allowlistPublisher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const POINTS_LEDGER_PUBLISHER_ABI = [
  {
    type: 'function',
    name: 'pointsLedgerPublisher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  if (!isAmoeZkSubmitEnabled()) {
    return res.status(503).json({ ok: false, error: 'zk_path_disabled' })
  }

  const lotteryAmoeRouter = readLotteryAmoeRouterAddress()
  if (!lotteryAmoeRouter) {
    return res
      .status(503)
      .json({ ok: false, error: 'lottery_amoe_router_not_configured' })
  }

  const expectedPublisher = readAmoeLedgerPublisherSmartWallet()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(readBaseRpcUrlForPublisher(), { timeout: 30_000 }),
  })

  const [allowlistPublisher, pointsLedgerPublisher] = await Promise.all([
    publicClient.readContract({
      address: lotteryAmoeRouter,
      abi: ALLOWLIST_PUBLISHER_ABI,
      functionName: 'allowlistPublisher',
    }),
    publicClient.readContract({
      address: lotteryAmoeRouter,
      abi: POINTS_LEDGER_PUBLISHER_ABI,
      functionName: 'pointsLedgerPublisher',
    }),
  ])

  const roleOk =
    isAddressEqual(allowlistPublisher as Address, expectedPublisher) &&
    isAddressEqual(pointsLedgerPublisher as Address, expectedPublisher)

  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const currentEpoch = computeAmoeEpoch(nowSec)
  const latestClosedEpoch = currentEpoch > 0n ? currentEpoch - 1n : 0n

  let allowlistRootSet = false
  let ledgerRootSet = false
  let allowlistRootHex: string | null = null
  let ledgerRootHex: string | null = null

  if (latestClosedEpoch > 0n) {
    const [allowRoot, ledgerRoot] = await Promise.all([
      readAllowlistRootOf({
        publicClient,
        lotteryAmoeRouter,
        epoch: latestClosedEpoch,
      }),
      readPointsLedgerRootOf({
        publicClient,
        lotteryAmoeRouter,
        epoch: latestClosedEpoch,
      }),
    ])
    allowlistRootHex = normalizeRootHex(allowRoot)
    ledgerRootHex = normalizeRootHex(ledgerRoot)
    allowlistRootSet = !isZeroRoot(allowlistRootHex)
    ledgerRootSet = !isZeroRoot(ledgerRootHex)
  }

  let dbAllowlistPublished = false
  let ledgerEmptyOk = false
  try {
    const db = await requirePublisherDb()
    if (latestClosedEpoch > 0n) {
      const allowDb = await db.sql`
        SELECT publish_tx_hash, publish_confirmed_at
        FROM amoe_wallet_allowlist_snapshots
        WHERE epoch = ${latestClosedEpoch.toString()}::bigint
        LIMIT 1
      `
      const allowRow = (allowDb.rows ?? [])[0] as
        | { publish_tx_hash?: string | null; publish_confirmed_at?: string | null }
        | undefined
      dbAllowlistPublished = Boolean(
        allowRow?.publish_tx_hash || allowRow?.publish_confirmed_at,
      )

      const ledgerNoOp = await db.sql`
        SELECT 1
        FROM amoe_publisher_runs
        WHERE epoch = ${latestClosedEpoch.toString()}::bigint
          AND phase = 'finished_no_op'
          AND finished_at IS NOT NULL
        LIMIT 1
      `
      ledgerEmptyOk = (ledgerNoOp.rows ?? []).length > 0
    }
  } catch {
    // DB optional for role/on-chain checks; leave db flags false.
  }

  const ledgerOk = ledgerRootSet || ledgerEmptyOk || !isAmoeLedgerPublisherEnabled()
  const allowlistHealthy =
    !isAmoeAllowlistPublisherEnabled() ||
    latestClosedEpoch === 0n ||
    allowlistRootSet

  const ok =
    roleOk &&
    allowlistHealthy &&
    (latestClosedEpoch === 0n || ledgerRootSet || ledgerEmptyOk)

  return res.status(ok ? 200 : 503).json({
    ok,
    roleOk,
    expectedPublisher,
    allowlistPublisher,
    pointsLedgerPublisher,
    currentEpoch: currentEpoch.toString(),
    latestClosedEpoch: latestClosedEpoch.toString(),
    allowlistRootSet,
    ledgerRootSet,
    ledgerEmptyOk,
    dbAllowlistPublished,
    allowlistRootHex,
    ledgerRootHex: ledgerRootHex === AMOE_ZERO_ROOT ? AMOE_ZERO_ROOT : ledgerRootHex,
    flags: {
      zkSubmitEnabled: isAmoeZkSubmitEnabled(),
      ledgerPublisherEnabled: isAmoeLedgerPublisherEnabled(),
      allowlistPublisherEnabled: isAmoeAllowlistPublisherEnabled(),
    },
    ledgerOk,
    allowlistOk: allowlistHealthy,
  })
}
