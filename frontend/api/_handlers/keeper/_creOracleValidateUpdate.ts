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
  buildAttestationDedupeKey,
  deriveCreReportId,
  normalizeAddress,
  normalizeReportIdHex,
  parseBooleanFlag,
  upsertKeeperCreAttestation,
} from '../../../server/_lib/keeper/creAttestations.js'

type CreOracleValidateUpdateBody = {
  oracleAddress?: string
  proposedPrice?: string | number
  reportId?: string
  reportTimestampMs?: number
  source?: string
  attestationDigest?: string
  forceWrite?: boolean
}

type CreOracleValidateUpdateResponse = {
  status: 'monitor_only' | 'updated' | 'rejected'
  reason: string
  reportId: string
  divergenceBps?: number
  txHash?: string
}

const ORACLE_READ_ABI = [
  {
    type: 'function',
    name: 'getCreatorPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'price', type: 'int256' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
] as const

const ORACLE_WRITE_ABI = [
  {
    type: 'function',
    name: 'updateCreatorPrice',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_price', type: 'int256' }],
    outputs: [],
  },
] as const

function parsePositivePrice(input: unknown): bigint | null {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) return BigInt(Math.floor(input))
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    const value = BigInt(raw)
    return value > 0n ? value : null
  } catch {
    return null
  }
}

function classifyWriteError(error: unknown): string {
  const text = String(error instanceof Error ? error.message : error).toLowerCase()
  if (text.includes('pricedeviationtoohigh')) return 'price_deviation_too_high'
  if (text.includes('unauthorized')) return 'oracle_unauthorized'
  if (text.includes('oraclenotinitialized')) return 'oracle_not_initialized'
  if (text.includes('insufficient funds')) return 'keeper_wallet_unfunded'
  return 'oracle_update_failed'
}

function readOracleAllowlist(): Set<string> {
  const out = new Set<string>()
  const raw = String(process.env.CRE_ORACLE_ALLOWLIST ?? '')
  for (const token of raw.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(token)
    if (normalized) out.add(normalized)
  }
  return out
}

function computeDivergenceBps(current: bigint, proposed: bigint): number {
  if (current <= 0n || proposed <= 0n) return 1_000_000
  const delta = current > proposed ? current - proposed : proposed - current
  return Number((delta * 10_000n) / current)
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
    rateLimitKey('keeper-cre-oracle-validate-update', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody<CreOracleValidateUpdateBody>(req, { maxBytes: 16_384 })) ?? {}
  const oracleAddress = normalizeAddress(body.oracleAddress)
  if (!oracleAddress) {
    return res.status(400).json({ success: false, error: 'invalid_oracle_address' } satisfies ApiEnvelope<never>)
  }
  const allowlist = readOracleAllowlist()
  if (allowlist.size > 0 && !allowlist.has(oracleAddress)) {
    return res.status(403).json({ success: false, error: 'oracle_not_allowlisted' } satisfies ApiEnvelope<never>)
  }

  const proposedPrice = parsePositivePrice(body.proposedPrice)
  if (proposedPrice === null) {
    return res.status(400).json({ success: false, error: 'invalid_proposed_price' } satisfies ApiEnvelope<never>)
  }
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 200) : ''
  if (!source) {
    return res.status(400).json({ success: false, error: 'invalid_source' } satisfies ApiEnvelope<never>)
  }
  const reportTimestampMs =
    typeof body.reportTimestampMs === 'number' && Number.isFinite(body.reportTimestampMs)
      ? Math.floor(body.reportTimestampMs)
      : Date.now()
  const reportTimestamp = new Date(reportTimestampMs)
  if (!Number.isFinite(reportTimestamp.getTime())) {
    return res.status(400).json({ success: false, error: 'invalid_report_timestamp' } satisfies ApiEnvelope<never>)
  }

  const reportId =
    normalizeReportIdHex(body.reportId) ??
    deriveCreReportId([oracleAddress, proposedPrice.toString(), reportTimestamp.toISOString(), source, body.attestationDigest ?? ''])
  const dedupeKey = buildAttestationDedupeKey({
    attestationKind: 'creator_oracle',
    primaryAddress: oracleAddress,
    reportId,
  })

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any

  const creatorPriceResult = await publicClient.readContract({
    address: oracleAddress,
    abi: ORACLE_READ_ABI as unknown as Abi,
    functionName: 'getCreatorPrice',
  })
  const currentPrice = BigInt(Array.isArray(creatorPriceResult) ? creatorPriceResult[0] ?? 0 : 0)
  const divergenceBps = computeDivergenceBps(currentPrice, proposedPrice)
  const maxDivergenceBps = Math.max(
    10,
    Math.min(10_000, Math.floor(Number(process.env.CRE_ORACLE_MAX_DIVERGENCE_BPS ?? 2000))),
  )
  const withinDivergence = currentPrice > 0n && divergenceBps <= maxDivergenceBps

  const shadowOnly = parseBooleanFlag(process.env.CRE_ORACLE_SHADOW_ONLY, true)
  const writeEnabled = parseBooleanFlag(process.env.CRE_ORACLE_VALIDATOR_WRITE_ENABLED, false)
  const killSwitch = parseBooleanFlag(process.env.CRE_KILL_SWITCH, false)
  const forceWrite = body.forceWrite === true
  const shouldWrite = !killSwitch && writeEnabled && withinDivergence && (!shadowOnly || forceWrite)

  const db = await getDbForCron()
  if (db && isDbConfigured()) {
    await ensureKeeperCreSchema(db)
    await upsertKeeperCreAttestation(db, {
      dedupeKey,
      attestationKind: 'creator_oracle',
      status: shouldWrite ? 'queued' : 'shadow_only',
      source,
      payload: {
        oracleAddress,
        proposedPrice: proposedPrice.toString(),
        reportId,
        reportTimestampMs,
      },
      oracleAddress,
      reportId,
      proposedPrice: proposedPrice.toString(),
      reportTimestamp: reportTimestamp.toISOString(),
      attestationDigest: typeof body.attestationDigest === 'string' ? body.attestationDigest.slice(0, 256) : null,
      decision: {
        currentPrice: currentPrice.toString(),
        divergenceBps,
        maxDivergenceBps,
        shadowOnly,
        writeEnabled,
        killSwitch,
        forceWrite,
        withinDivergence,
      },
    })
  }

  if (!shouldWrite) {
    return res.status(200).json({
      success: true,
      data: {
        status: withinDivergence ? 'monitor_only' : 'rejected',
        reason: withinDivergence ? 'monitor_mode_or_write_disabled' : 'divergence_above_threshold',
        reportId,
        divergenceBps,
      },
    } satisfies ApiEnvelope<CreOracleValidateUpdateResponse>)
  }

  const keeperPk = String(process.env.KPR_PRIVATE_KEY ?? '').trim()
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }
  const account = privateKeyToAccount(keeperPk as `0x${string}`)
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })

  try {
    const txHash = await walletClient.writeContract({
      address: oracleAddress,
      abi: ORACLE_WRITE_ABI as unknown as Abi,
      functionName: 'updateCreatorPrice',
      args: [proposedPrice],
      chain: base,
      account,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
    if (db && isDbConfigured()) {
      await upsertKeeperCreAttestation(db, {
        dedupeKey,
        attestationKind: 'creator_oracle',
        status: 'executed',
        source,
        payload: {
          oracleAddress,
          proposedPrice: proposedPrice.toString(),
          reportId,
          reportTimestampMs,
        },
        oracleAddress,
        reportId,
        proposedPrice: proposedPrice.toString(),
        executionTxHash: txHash,
        reportTimestamp: reportTimestamp.toISOString(),
        decision: { executedAt: new Date().toISOString(), divergenceBps },
      })
    }
    return res.status(200).json({
      success: true,
      data: {
        status: 'updated',
        reason: 'tx_confirmed',
        reportId,
        divergenceBps,
        txHash,
      },
    } satisfies ApiEnvelope<CreOracleValidateUpdateResponse>)
  } catch (error) {
    const code = classifyWriteError(error)
    if (db && isDbConfigured()) {
      await upsertKeeperCreAttestation(db, {
        dedupeKey,
        attestationKind: 'creator_oracle',
        status: 'execution_failed',
        source,
        payload: {
          oracleAddress,
          proposedPrice: proposedPrice.toString(),
          reportId,
          reportTimestampMs,
        },
        oracleAddress,
        reportId,
        proposedPrice: proposedPrice.toString(),
        reportTimestamp: reportTimestamp.toISOString(),
        errorCode: code,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
    return res.status(200).json({
      success: false,
      error: code,
      data: {
        status: 'rejected',
        reason: code,
        reportId,
        divergenceBps,
      },
    } satisfies ApiEnvelope<CreOracleValidateUpdateResponse>)
  }
}
