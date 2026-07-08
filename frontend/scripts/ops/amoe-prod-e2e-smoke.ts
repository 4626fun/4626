#!/usr/bin/env tsx
/**
 * Production AMOE burn → publish → submit-zk smoke.
 *
 * Phase A: debit credits + seed projector context (canonical CSW account).
 * Wait: until the burn epoch closes (~1 day boundary).
 * Publish: ledger + allowlist roots via production cron.
 * Phase B: PLONK prove + relay `submitAmoeEntryZK` on Base mainnet.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/amoe-prod-e2e-smoke.ts --phase burn
 *   pnpm -C frontend exec tsx scripts/ops/amoe-prod-e2e-smoke.ts --phase publish
 *   pnpm -C frontend exec tsx scripts/ops/amoe-prod-e2e-smoke.ts --phase submit
 *   pnpm -C frontend exec tsx scripts/ops/amoe-prod-e2e-smoke.ts --phase all
 */

import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { privateKeyToAccount } from 'viem/accounts'

import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { getApiContracts } from '../../server/_lib/onchain/contracts.js'
import { CANONICAL_CSW_ADDRESS } from '../../src/wallet/canonicalWalletPolicy.js'
import {
  buildAmoeEntryMessage,
  consumeAmoeCreditsForEntry,
  issueAmoeNonce,
} from '../../server/_lib/lottery/lotteryAmoe.js'
import { seedBurnProjectionContext } from '../../server/_lib/lottery/amoeBurnProjectionSeed.js'
import {
  AMOE_EPOCH_GENESIS_UNIX_SEC,
  AMOE_EPOCH_SECONDS,
  computeAmoeEpoch,
  defaultAmoeZkAssetPaths,
  orchestrateAmoeSubmitZk,
  readLotteryAmoeRouterAddress,
} from '../../server/_lib/lottery/amoeSubmitZk.js'
import { AmoeAllowlistSnapshotPgReader } from '../../server/_lib/lottery/amoeAllowlistSnapshotReader.js'
import { AmoeLedgerSnapshotPgReader } from '../../server/_lib/lottery/amoeLedgerSnapshotReader.js'
import { consumeAmoeNonceForSubmit } from '../../server/_lib/lottery/amoeNonceStore.js'
import { createAmoeRelay } from '../../server/_lib/lottery/amoeRelay.js'
import { getDb } from '../../server/_lib/db/postgres.js'
import {
  defaultBroadcastSetPointsLedgerRoot,
  defaultConfirmTransactionReceipt,
  defaultLookupBurnContext,
  pickNextEpochToPublish,
  publishEpoch,
  readPublisherClaimedBy,
  reclaimStrandedPublisherRuns,
  requirePublisherDb,
} from '../../server/_lib/lottery/amoeLedgerPublisher.js'
import {
  isAmoeAllowlistPublisherEnabled,
  publishAllowlistEpoch,
} from '../../server/_lib/lottery/amoeAllowlistPublisher.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code: number) => void
  cwd: () => string
}

const STATE_PATH = resolve(process.cwd(), '.cache/amoe-prod-e2e-smoke.json')
const API_ORIGIN = (process.env.AMOE_SMOKE_API_ORIGIN ?? 'https://app.4626.fun').replace(/\/$/, '')
const CANONICAL_WALLET = CANONICAL_CSW_ADDRESS.toLowerCase() as `0x${string}`
const CREATOR_COIN = AKITA_DEFAULTS.token.toLowerCase() as `0x${string}`
const POINTS_BURNED = 100
const TWITTER_HANDLE = process.env.AMOE_SMOKE_TWITTER_HANDLE ?? '4626'

type SmokeState = {
  spendRefId: string
  nonce: `0x${string}`
  message: string
  signature: `0x${string}`
  burnEpoch: string
  burnedAt: string
  signupId: number
}

function log(step: string, detail?: unknown) {
  const suffix = detail === undefined ? '' : ` ${JSON.stringify(detail)}`
  process.stdout.write(`[amoe-smoke] ${step}${suffix}\n`)
}

function readPrivateKey(): `0x${string}` {
  const raw = String(process.env.PRIVATE_KEY ?? process.env.LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error('Missing PRIVATE_KEY or LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY')
  }
  return raw as `0x${string}`
}

function loadState(): SmokeState | null {
  if (!existsSync(STATE_PATH)) return null
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as SmokeState
}

function saveState(state: SmokeState) {
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function parsePhase(): 'burn' | 'publish' | 'submit' | 'all' {
  const arg = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--phase') + 1]
    ?? 'all'
  if (arg === 'burn' || arg === 'publish' || arg === 'submit' || arg === 'all') return arg
  throw new Error(`Unknown phase ${arg}`)
}

async function sleepMs(ms: number) {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function runBurnPhase(): Promise<SmokeState> {
  const existing = loadState()
  if (existing) {
    log('burn: reusing saved state', { spendRefId: existing.spendRefId, burnEpoch: existing.burnEpoch })
    return existing
  }

  const lotteryManager = String(getApiContracts().lotteryManager ?? '').toLowerCase() as `0x${string}`
  if (!/^0x[a-f0-9]{40}$/.test(lotteryManager)) {
    throw new Error('Lottery manager not configured')
  }

  const noncePayload = await issueAmoeNonce({
    wallet: CANONICAL_WALLET,
    creatorCoin: CREATOR_COIN,
  })
  const spendRefId = `smoke-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const message = buildAmoeEntryMessage({
    wallet: CANONICAL_WALLET,
    creatorCoin: CREATOR_COIN,
    nonce: noncePayload.nonce,
    issuedAt: noncePayload.issuedAt,
    expiresAt: noncePayload.expiresAt,
    chainId: 8453,
    lotteryManager,
  })

  const account = privateKeyToAccount(readPrivateKey())
  const signature = await account.signMessage({ message })

  const debit = await consumeAmoeCreditsForEntry({
    wallet: CANONICAL_WALLET,
    requiredCredits: POINTS_BURNED,
    refId: spendRefId,
  })
  if (typeof debit.signupId !== 'number' || debit.signupId <= 0) {
    throw new Error('Burn succeeded but signupId missing')
  }

  await seedBurnProjectionContext({
    signupId: debit.signupId,
    wallet: CANONICAL_WALLET,
    creatorCoin: CREATOR_COIN,
    burnEpoch: debit.burnEpoch,
    spendRefId,
    pointsBurned: POINTS_BURNED,
    twitterHandle: TWITTER_HANDLE,
  })

  const state: SmokeState = {
    spendRefId,
    nonce: noncePayload.nonce,
    message,
    signature,
    burnEpoch: debit.burnEpoch,
    burnedAt: debit.burnedAt,
    signupId: debit.signupId,
  }
  saveState(state)
  log('burn: complete', {
    spendRefId,
    burnEpoch: debit.burnEpoch,
    creditsRemaining: debit.creditsRemaining,
    eligibleAfter: Number(AMOE_EPOCH_GENESIS_UNIX_SEC + (BigInt(debit.burnEpoch) + 1n) * AMOE_EPOCH_SECONDS),
  })
  return state
}

async function waitForEpochClose(burnEpoch: bigint) {
  const targetOpenEpoch = burnEpoch + 1n
  const targetUnix = AMOE_EPOCH_GENESIS_UNIX_SEC + targetOpenEpoch * AMOE_EPOCH_SECONDS
  while (true) {
    const nowSec = BigInt(Math.floor(Date.now() / 1000))
    const current = computeAmoeEpoch(nowSec)
    if (current >= targetOpenEpoch) {
      log('epoch: closed', { burnEpoch: burnEpoch.toString(), currentEpoch: current.toString() })
      return
    }
    const waitSec = Number(targetUnix - nowSec)
    log('epoch: waiting', { secondsRemaining: waitSec, burnEpoch: burnEpoch.toString() })
    await sleepMs(Math.min(waitSec * 1000, 60_000))
  }
}

async function runLocalPublishTick(targetEpoch: bigint): Promise<void> {
  const db = await requirePublisherDb()
  const router = readLotteryAmoeRouterAddress()
  if (!router) throw new Error('LOTTERY_AMOE_ROUTER missing')

  await reclaimStrandedPublisherRuns(db).catch(() => 0)

  if (isAmoeAllowlistPublisherEnabled()) {
    const allow = await publishAllowlistEpoch({
      db,
      epoch: targetEpoch,
      lotteryAmoeRouter: router,
      publisherVersion: 'amoe-prod-e2e-smoke',
    })
    log('local-publish: allowlist', allow)
  }

  const outcome = await publishEpoch({
    db,
    epoch: targetEpoch,
    claimedBy: readPublisherClaimedBy(),
    lotteryAmoeRouter: router,
    broadcast: defaultBroadcastSetPointsLedgerRoot,
    confirm: defaultConfirmTransactionReceipt,
    lookupBurnContext: (args) => defaultLookupBurnContext(db, args),
    publisherVersion: 'amoe-prod-e2e-smoke',
  })
  log('local-publish: ledger', outcome)
}

async function callPublishCron(): Promise<Record<string, unknown>> {
  const secret = String(process.env.CRON_SECRET ?? '').trim()
  if (!secret) throw new Error('CRON_SECRET missing')
  const res = await fetch(`${API_ORIGIN}/api/v1/lottery/amoe/publish-cron`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(`publish-cron HTTP ${res.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function runPublishPhase(state: SmokeState) {
  const burnEpoch = BigInt(state.burnEpoch)
  await waitForEpochClose(burnEpoch)

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const body = await callPublishCron()
      log('publish-cron', { attempt, body })
    } catch (cronErr) {
      log('publish-cron: unauthorized or failed; falling back to local publisher', {
        error: cronErr instanceof Error ? cronErr.message : String(cronErr),
      })
      await runLocalPublishTick(burnEpoch)
    }

    const db = await getDb()
    if (!db) throw new Error('DATABASE_URL not configured locally')

    const ledger = await db.sql`
      SELECT publish_confirmed_at IS NOT NULL AS confirmed, leaf_count
      FROM amoe_points_burn_ledger_snapshots
      WHERE epoch = ${state.burnEpoch}::bigint
      LIMIT 1
    `
    const allow = await db.sql`
      SELECT publish_confirmed_at IS NOT NULL AS confirmed, leaf_count
      FROM amoe_wallet_allowlist_snapshots
      WHERE epoch = ${state.burnEpoch}::bigint
      LIMIT 1
    `
    const ledgerConfirmed = ledger.rows?.[0]?.confirmed === true
    const allowConfirmed = allow.rows?.[0]?.confirmed === true
    const ledgerLeaves = Number(ledger.rows?.[0]?.leaf_count ?? 0)
    if (ledgerConfirmed && allowConfirmed && ledgerLeaves > 0) {
      log('publish: roots confirmed', { epoch: state.burnEpoch, ledgerLeaves })
      return
    }
    await sleepMs(60_000)
  }
  throw new Error(`Publish did not confirm ledger+allowlist for epoch ${state.burnEpoch}`)
}

async function runSubmitPhase(state: SmokeState) {
  await consumeAmoeNonceForSubmit({
    wallet: CANONICAL_WALLET,
    creatorCoin: CREATOR_COIN,
    nonce: state.nonce,
  })

  const db = await getDb()
  if (!db) throw new Error('DATABASE_URL not configured locally')

  const ledgerReader = new AmoeLedgerSnapshotPgReader(db)
  const allowlistReader = new AmoeAllowlistSnapshotPgReader(db)
  const { wasmPath, zkeyPath } = defaultAmoeZkAssetPaths()
  const router = readLotteryAmoeRouterAddress()
  if (!router) throw new Error('LOTTERY_AMOE_ROUTER missing')

  log('submit: proving', { spendRefId: state.spendRefId, wasmPath, zkeyPath })
  const result = await orchestrateAmoeSubmitZk(
    {
      wallet: CANONICAL_WALLET,
      creatorCoin: CREATOR_COIN,
      pointsBurned: POINTS_BURNED,
      nonce: state.nonce,
      twitterHandle: TWITTER_HANDLE,
      spendRefId: state.spendRefId,
      profileId: BigInt(state.signupId),
      lotteryAmoeRouter: router,
    },
    { wasmPath, zkeyPath, ledgerSnapshotReader: ledgerReader, allowlistSnapshotReader: allowlistReader },
  )

  const relay = createAmoeRelay()
  if (!relay) throw new Error('AMOE relay not configured')

  log('submit: relaying', { epoch: result.epoch.toString(), to: result.call.to })
  const txHash = await relay({
    to: result.call.to,
    callData: result.call.callData,
  })
  log('submit: on-chain success', { txHash, epoch: result.epoch.toString() })
}

async function main() {
  const phase = parsePhase()
  log('start', { phase, apiOrigin: API_ORIGIN, wallet: CANONICAL_WALLET })

  let state = loadState()
  if (phase === 'burn' || phase === 'all') {
    state = await runBurnPhase()
  }
  if (!state) throw new Error('No smoke state — run --phase burn first')

  if (phase === 'publish' || phase === 'all') {
    await runPublishPhase(state)
  }
  if (phase === 'submit' || phase === 'all') {
    await runSubmitPhase(state)
  }
}

main().catch((err) => {
  process.stderr.write(`[amoe-smoke] failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
