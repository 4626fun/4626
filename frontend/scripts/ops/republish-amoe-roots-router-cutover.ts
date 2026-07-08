#!/usr/bin/env tsx
/**
 * One-shot AMOE router cutover helper: rebroadcast allowlist + ledger Merkle
 * roots from Postgres onto a new `LOTTERY_AMOE_ROUTER` after greenfield deploy.
 *
 * NOTE: Production/local Privy CSW publisher may fail with
 * `userop_submission_failed` / `privy_http_401` when authorization keys are
 * stale. For cutover, use the treasury-EOA fallback documented in
 * `script/republish-amoe-roots-treasury-cutover.sh` (temporarily repoint
 * router publishers → publish roots → restore canonical CSW publishers).
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/republish-amoe-roots-router-cutover.ts --epochs 67,68
 */

import {
  defaultBroadcastSetAllowlistRoot,
  publishAllowlistEpoch,
  requireAllowlistPublisherDb,
} from '../../server/_lib/lottery/amoeAllowlistPublisher.js'
import {
  defaultBroadcastSetPointsLedgerRoot,
  defaultConfirmTransactionReceipt,
  defaultLookupBurnContext,
  publishEpoch,
  readPublisherClaimedBy,
  requirePublisherDb,
} from '../../server/_lib/lottery/amoeLedgerPublisher.js'
import { readLotteryAmoeRouterAddress } from '../../server/_lib/lottery/amoeSubmitZk.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code: number) => void
}

function parseEpochs(): bigint[] {
  const arg =
    process.argv.find((a) => a.startsWith('--epochs='))?.split('=')[1] ??
    process.argv[process.argv.indexOf('--epochs') + 1] ??
    '68'
  return arg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s))
}

async function resetPublishState(epochs: bigint[]): Promise<void> {
  const db = await requirePublisherDb()
  for (const epoch of epochs) {
    await db.sql`
      UPDATE amoe_wallet_allowlist_snapshots
      SET publish_tx_hash = NULL,
          publish_block_number = NULL,
          publish_confirmed_at = NULL
      WHERE epoch = ${epoch.toString()}::bigint
    `
    await db.sql`
      UPDATE amoe_points_burn_ledger_snapshots
      SET publish_tx_hash = NULL,
          publish_block_number = NULL,
          publish_confirmed_at = NULL
      WHERE epoch = ${epoch.toString()}::bigint
    `
    await db.sql`
      UPDATE amoe_publisher_runs
      SET phase = 'errored',
          finished_at = NOW(),
          last_error = 'router_cutover_reset'
      WHERE epoch = ${epoch.toString()}::bigint
        AND finished_at IS NULL
    `
  }
}

async function confirmAllowlistPublish(
  epoch: bigint,
  txHash: `0x${string}`,
): Promise<void> {
  const db = await requireAllowlistPublisherDb()
  const receipt = await defaultConfirmTransactionReceipt({
    txHash,
    timeoutMs: 120_000,
  })
  if (!receipt) {
    throw new Error(`allowlist_confirm_timeout epoch=${epoch.toString()} tx=${txHash}`)
  }
  await db.sql`
    UPDATE amoe_wallet_allowlist_snapshots
    SET publish_block_number = ${receipt.blockNumber.toString()}::bigint,
        publish_confirmed_at = NOW()
    WHERE epoch = ${epoch.toString()}::bigint
      AND publish_tx_hash = ${txHash}
  `
}

async function main() {
  const epochs = parseEpochs()
  const router = readLotteryAmoeRouterAddress()
  if (!router) {
    throw new Error('LOTTERY_AMOE_ROUTER missing or invalid')
  }

  process.stdout.write(
    `[amoe-cutover] router=${router} epochs=${epochs.map((e) => e.toString()).join(',')}\n`,
  )

  await resetPublishState(epochs)

  const allowlistDb = await requireAllowlistPublisherDb()
  const ledgerDb = await requirePublisherDb()
  const publisherVersion = 'v1.18.0-router-cutover'

  for (const epoch of epochs) {
    const allow = await publishAllowlistEpoch({
      db: allowlistDb,
      epoch,
      lotteryAmoeRouter: router,
      publisherVersion,
      broadcast: defaultBroadcastSetAllowlistRoot,
    })
    process.stdout.write(`[amoe-cutover] allowlist epoch=${epoch.toString()} ${JSON.stringify(allow)}\n`)
    if (allow.kind === 'finished') {
      await confirmAllowlistPublish(epoch, allow.txHash)
    }
  }

  for (const epoch of epochs) {
    const snap = await ledgerDb.sql`
      SELECT leaf_count FROM amoe_points_burn_ledger_snapshots
      WHERE epoch = ${epoch.toString()}::bigint
      LIMIT 1
    `
    const leafCount = Number((snap.rows?.[0] as { leaf_count?: number | string } | undefined)?.leaf_count ?? 0)
    if (leafCount <= 0) {
      process.stdout.write(`[amoe-cutover] ledger epoch=${epoch.toString()} skip empty\n`)
      continue
    }

    const ledger = await publishEpoch({
      db: ledgerDb,
      epoch,
      claimedBy: readPublisherClaimedBy(),
      lotteryAmoeRouter: router,
      broadcast: defaultBroadcastSetPointsLedgerRoot,
      confirm: defaultConfirmTransactionReceipt,
      lookupBurnContext: (args) => defaultLookupBurnContext(ledgerDb, args),
      publisherVersion,
    })
    process.stdout.write(`[amoe-cutover] ledger epoch=${epoch.toString()} ${JSON.stringify(ledger)}\n`)
  }

  const [{ createPublicClient, http }, { base }] = await Promise.all([
    import('viem'),
    import('viem/chains'),
  ])
  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      String(process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'),
      { timeout: 30_000 },
    ),
  })
  const routerAbi = [
    {
      type: 'function',
      name: 'allowlistRootOf',
      stateMutability: 'view',
      inputs: [{ name: 'epoch', type: 'uint64' }],
      outputs: [{ type: 'bytes32' }],
    },
    {
      type: 'function',
      name: 'pointsLedgerRootOf',
      stateMutability: 'view',
      inputs: [{ name: 'epoch', type: 'uint64' }],
      outputs: [{ type: 'bytes32' }],
    },
  ] as const

  for (const epoch of epochs) {
    const [allowlistRoot, ledgerRoot] = await Promise.all([
      publicClient.readContract({
        address: router,
        abi: routerAbi,
        functionName: 'allowlistRootOf',
        args: [epoch],
      }),
      publicClient.readContract({
        address: router,
        abi: routerAbi,
        functionName: 'pointsLedgerRootOf',
        args: [epoch],
      }),
    ])
    process.stdout.write(
      `[amoe-cutover] on-chain epoch=${epoch.toString()} allowlist=${allowlistRoot} ledger=${ledgerRoot}\n`,
    )
  }
}

main().catch((err) => {
  process.stderr.write(
    `[amoe-cutover] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  )
  process.exit(1)
})
