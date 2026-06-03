import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  getDbForCron,
  handleOptions,
  isDbConfigured,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { createPublicClient, createWalletClient, http, type Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { ensureKeeperCreSchema } from '../../../server/_lib/db/schemaBootstrap.js'
import {
  normalizeAddress,
  normalizeReportIdHex,
  parseBooleanFlag,
  upsertKeeperCreAttestation,
} from '../../../server/_lib/keeper/creAttestations.js'

type CreSolanaNavUpdateBody = {
  attestationId?: number
  strategyAddress?: string
  reportId?: string
  reportedRemoteNav?: string | number
  source?: string
  reportTimestampMs?: number
}

type CreSolanaNavUpdateResponse = {
  status: 'executed' | 'skipped'
  reason: string
  txHash?: string
}

const SOLANA_STRATEGY_ABI = [
  {
    type: 'function',
    name: 'updateRemoteNav',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'newRemoteNav', type: 'uint256' },
      { name: 'reportId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

function parseNavValue(input: unknown): bigint | null {
  if (typeof input === 'number' && Number.isFinite(input) && input >= 0) return BigInt(Math.floor(input))
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

function classifyFailure(error: unknown): string {
  const text = String(error instanceof Error ? error.message : error).toLowerCase()
  if (text.includes('reportidalreadyused') || text.includes('0x')) return 'report_id_already_used_or_contract_revert'
  if (text.includes('onlykeeper') || text.includes('unauthorized')) return 'strategy_keeper_unauthorized'
  if (text.includes('navdeltaexceedscap')) return 'nav_delta_exceeds_cap'
  if (text.includes('insufficient funds')) return 'keeper_wallet_unfunded'
  return 'execution_failed'
}

function strategyAllowlisted(address: `0x${string}`): boolean {
  const raw = String(process.env.CRE_SOLANA_NAV_STRATEGY_ALLOWLIST ?? '')
  const entries = raw
    .split(/[\s,]+/g)
    .map((entry) => normalizeAddress(entry))
    .filter((entry): entry is `0x${string}` => Boolean(entry))
  if (entries.length === 0) return true
  return entries.includes(address)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-cre-solana-nav-update', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const writeEnabled = parseBooleanFlag(process.env.CRE_SOLANA_NAV_WRITE_ENABLED, false)
  const hardStop = parseBooleanFlag(process.env.CRE_KILL_SWITCH, false)
  if (!writeEnabled || hardStop) {
    return res.status(200).json({
      success: true,
      data: {
        status: 'skipped',
        reason: !writeEnabled ? 'cre_solana_nav_write_disabled' : 'cre_kill_switch_enabled',
      },
    } satisfies ApiEnvelope<CreSolanaNavUpdateResponse>)
  }

  const body = (await readBoundedJsonObjectBody<CreSolanaNavUpdateBody>(req, { maxBytes: 16_384 })) ?? {}
  const strategyAddress = normalizeAddress(body.strategyAddress)
  const reportId = normalizeReportIdHex(body.reportId)
  const navValue = parseNavValue(body.reportedRemoteNav)
  if (!strategyAddress || !reportId || navValue === null) {
    return res.status(400).json({ success: false, error: 'invalid_payload' } satisfies ApiEnvelope<never>)
  }
  if (!strategyAllowlisted(strategyAddress)) {
    return res.status(403).json({ success: false, error: 'strategy_not_allowlisted' } satisfies ApiEnvelope<never>)
  }

  const source = typeof body.source === 'string' ? body.source.slice(0, 200) : 'keeper-cre-solana-nav'
  const dedupeKey = `solana_nav:${strategyAddress}:${reportId}`.toLowerCase()
  const db = await getDbForCron()
  if (db) {
    await ensureKeeperCreSchema(db)
    await upsertKeeperCreAttestation(db, {
      dedupeKey,
      attestationKind: 'solana_nav',
      status: 'queued',
      source,
      payload: {
        strategyAddress,
        reportId,
        reportedRemoteNav: navValue.toString(),
        reportTimestampMs: body.reportTimestampMs ?? null,
      },
      strategyAddress,
      reportId,
      navValue: navValue.toString(),
      decision: { executionStartedAt: new Date().toISOString() },
      executionJobId: Number.isInteger(body.attestationId) ? Number(body.attestationId) : null,
    })
  }

  const keeperPk = String(process.env.KPR_PRIVATE_KEY ?? '').trim()
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  const account = privateKeyToAccount(keeperPk as `0x${string}`)
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })

  try {
    const txHash = await walletClient.writeContract({
      address: strategyAddress,
      abi: SOLANA_STRATEGY_ABI as unknown as Abi,
      functionName: 'updateRemoteNav',
      args: [navValue, reportId],
      chain: base,
      account,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })

    if (db && isDbConfigured()) {
      await upsertKeeperCreAttestation(db, {
        dedupeKey,
        attestationKind: 'solana_nav',
        status: 'executed',
        source,
        payload: {
          strategyAddress,
          reportId,
          reportedRemoteNav: navValue.toString(),
          reportTimestampMs: body.reportTimestampMs ?? null,
        },
        strategyAddress,
        reportId,
        navValue: navValue.toString(),
        executionTxHash: txHash,
        decision: { executedAt: new Date().toISOString() },
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        status: 'executed',
        reason: 'tx_confirmed',
        txHash,
      },
    } satisfies ApiEnvelope<CreSolanaNavUpdateResponse>)
  } catch (error) {
    const code = classifyFailure(error)
    if (db && isDbConfigured()) {
      await upsertKeeperCreAttestation(db, {
        dedupeKey,
        attestationKind: 'solana_nav',
        status: 'execution_failed',
        source,
        payload: {
          strategyAddress,
          reportId,
          reportedRemoteNav: navValue.toString(),
          reportTimestampMs: body.reportTimestampMs ?? null,
        },
        strategyAddress,
        reportId,
        navValue: navValue.toString(),
        errorCode: code,
        errorMessage: error instanceof Error ? error.message : String(error),
        decision: { failedAt: new Date().toISOString() },
      })
    }
    console.warn('[keeper/cre-solana-nav-update] execution failed', {
      strategyAddress,
      reportId,
      code,
      message: error instanceof Error ? error.message : String(error),
    })
    return res.status(200).json({
      success: false,
      error: code,
      data: { status: 'skipped', reason: code },
    } satisfies ApiEnvelope<CreSolanaNavUpdateResponse>)
  }
}
