import type { VercelRequest, VercelResponse } from '@vercel/node'

import { decodeFunctionData, getAddress, isAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  logger,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


import { getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { buildUserOpErrorDebug } from '../../../../server/_lib/userOpRevertDebug.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'
import { parseGrant, validateCallsAgainstGrant } from '../../../../server/_lib/erc7712Permissions.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { ensureLaunchImageReady } from '../../../../server/_lib/deployLaunchImage.js'
import { verifyDeployPhase2Invariants } from '../../../../server/_lib/deployPhase2Invariants.js'
import { readSolanaOvaultMintCompatibilityHintsFromEnv } from '../../../../server/_lib/solanaOvaultCompatibility.js'
import { validateSponsoredSmartWalletCalls } from '../../_paymaster.js'
import { DeploySessionAccessError, loadAuthorizedDeploySession, normalizeDeploySessionId } from './_sessionAccess.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type ContinueRequest = { sessionId: string }
const STAGE_USEROP_HASH_PREFIX = 'stageUserOpHash_'
const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const SOLANA_RESERVE_PERCENT_BPS = 3_000n
const BPS_DENOMINATOR = 10_000n
const SESSION_EXPIRED_RESTART_REQUIRED = 'session_expired_restart_required'
const SESSION_EXPIRED_AT_KEY = 'sessionExpiredAt'
const SESSION_EXPIRED_REASON_KEY = 'sessionExpiredReason'
const REPLAY_SKIP_PHASE2_CORE_AT_KEY = 'replaySkipPhase2CoreAt'
const REPLAY_SKIP_PHASE2_CORE_REASON_KEY = 'replaySkipPhase2CoreReason'
const REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY = 'replaySkipPhase2FinalizeAt'
const REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY = 'replaySkipPhase2FinalizeReason'
const PHASE2_INVARIANT_GATE_KEY = 'phase2InvariantGate'
const PHASE2_INVARIANT_GATE_CHECKED_AT_KEY = 'phase2InvariantGateCheckedAt'

function isSessionExpired(expiresAt: unknown): boolean {
  if (typeof expiresAt !== 'string') return false
  const expiresMs = Date.parse(expiresAt)
  return Number.isFinite(expiresMs) && expiresMs <= Date.now()
}

function stageUserOpHashKey(step: string): string {
  return `${STAGE_USEROP_HASH_PREFIX}${step}`
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.find((entry) => typeof entry === 'string' && entry.trim())?.trim() ?? ''
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  const anyErr = error as any
  const candidates = [
    anyErr?.shortMessage,
    anyErr?.details,
    anyErr?.cause?.shortMessage,
    anyErr?.cause?.details,
    anyErr?.cause?.message,
    anyErr?.data?.message,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  try {
    const raw = JSON.stringify(error)
    if (raw && raw !== '{}' && raw !== 'null') return raw
  } catch {
    // ignore
  }
  return 'continue_failed'
}

function truncateMessage(input: string, max = 420): string {
  const msg = String(input ?? '')
  return msg.length > max ? `${msg.slice(0, max)}...` : msg
}

function isOnchainRevertLike(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('execution reverted') ||
    m.includes('user operation execution failed') ||
    m.includes('useroperationexecutionerror') ||
    m.includes('aa23 reverted') ||
    m.includes('aa33 reverted')
  )
}

function asPayloadObject(value: unknown): Record<string, any> {
  if (isPlainObject(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (isPlainObject(parsed)) return parsed
    } catch {
      // ignore malformed payload strings
    }
  }
  throw new Error('deploy_payload_invalid')
}

function isTruthyEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

function shouldPersistManagedSessionOwner(): boolean {
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, false)
}

function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase().endsWith('.vercel.app')
  } catch {
    return true
  }
}

function getBundlerEndpoint(origin: string): { url: string; viaProxy: boolean } {
  const direct =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  if (direct) return { url: direct, viaProxy: false }

  // On Vercel previews/production, same-origin /api/paymaster can be protected and fail
  // with HTML auth responses for server-to-server calls. Require direct CDP config instead.
  const isVercelEnv = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  if (isVercelEnv && isVercelDeploymentOrigin(origin)) {
    throw new Error('cdp_endpoint_missing_on_vercel')
  }

  return { url: `${origin}/api/paymaster`, viaProxy: true }
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

const OWNABLE_OWNER_VIEW_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareToken', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
] as const

const CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareToken', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

function parseBigIntLike(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = BigInt(value.trim())
      return parsed >= 0n ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function extractFinalizePhase2Info(data: Hex): {
  creatorToken: Address | null
  depositAmount: bigint | null
  owner: Address | null
  vault: Address | null
  gaugeController: Address | null
  ccaStrategy: Address | null
  oracle: Address | null
} | null {
  for (const abi of [CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI, CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        depositAmount?: bigint | string | number
        owner?: string
        vault?: string
        gaugeController?: string
        ccaStrategy?: string
        oracle?: string
      } | null
      const creatorTokenCandidate = params?.creatorToken && isAddress(params.creatorToken)
        ? getAddress(params.creatorToken as Address)
        : null
      const creatorToken =
        creatorTokenCandidate && creatorTokenCandidate.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
          ? creatorTokenCandidate
          : null
      if (!creatorToken) continue
      const normalizeAddress = (value: unknown): Address | null => {
        if (typeof value !== 'string' || !isAddress(value)) return null
        const addr = getAddress(value as Address)
        return addr.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : addr
      }
      return {
        creatorToken,
        depositAmount: parseBigIntLike(params?.depositAmount),
        owner: normalizeAddress(params?.owner),
        vault: normalizeAddress(params?.vault),
        gaugeController: normalizeAddress(params?.gaugeController),
        ccaStrategy: normalizeAddress(params?.ccaStrategy),
        oracle: normalizeAddress(params?.oracle),
      }
    } catch {
      continue
    }
  }
  return null
}

async function hasRuntimeCode(publicClient: any, address: Address | null): Promise<boolean> {
  if (!address) return false
  const getBytecode = publicClient?.getBytecode
  if (typeof getBytecode !== 'function') return false
  try {
    const bytecode = await getBytecode.call(publicClient, { address })
    return typeof bytecode === 'string' && bytecode !== '0x'
  } catch {
    return false
  }
}

async function readOwnableOwner(publicClient: any, address: Address | null): Promise<Address | null> {
  if (!address) return null
  try {
    const ownerRaw = await publicClient.readContract({
      address,
      abi: OWNABLE_OWNER_VIEW_ABI,
      functionName: 'owner',
    })
    if (typeof ownerRaw !== 'string' || !isAddress(ownerRaw)) return null
    const owner = getAddress(ownerRaw as Address)
    return owner.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : owner
  } catch {
    return null
  }
}

async function readPhase2ReplayState(params: {
  publicClient: any
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
}): Promise<{
  phase2CoreAlreadyDeployed: boolean
  phase2FinalizeAlreadyCompleted: boolean
}> {
  const finalizeCall = params.phase2FinalizeCalls[0]
  if (!finalizeCall) {
    return {
      phase2CoreAlreadyDeployed: false,
      phase2FinalizeAlreadyCompleted: false,
    }
  }
  const finalizeInfo = extractFinalizePhase2Info(finalizeCall.data)
  if (!finalizeInfo) {
    return {
      phase2CoreAlreadyDeployed: false,
      phase2FinalizeAlreadyCompleted: false,
    }
  }
  const [gaugeDeployed, ccaDeployed, oracleDeployed, vaultOwner] = await Promise.all([
    hasRuntimeCode(params.publicClient, finalizeInfo.gaugeController),
    hasRuntimeCode(params.publicClient, finalizeInfo.ccaStrategy),
    hasRuntimeCode(params.publicClient, finalizeInfo.oracle),
    readOwnableOwner(params.publicClient, finalizeInfo.vault),
  ])
  return {
    phase2CoreAlreadyDeployed: gaugeDeployed && ccaDeployed && oracleDeployed,
    phase2FinalizeAlreadyCompleted:
      Boolean(finalizeInfo.owner) &&
      Boolean(vaultOwner) &&
      String(finalizeInfo.owner).toLowerCase() === String(vaultOwner).toLowerCase(),
  }
}

async function ensureOvaultPreflight(params: {
  req: VercelRequest
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
  solanaOvault: unknown
}): Promise<{
  existingMintCompatible: boolean
  depositEligible: boolean
  redeemEligible: boolean
  assetPeerSet: boolean
  sharePeerSet: boolean
  meshStep: 'ovault_mesh_confirmed'
}> {
  const defaultStatus = {
    existingMintCompatible: true,
    depositEligible: true,
    redeemEligible: true,
    assetPeerSet: true,
    sharePeerSet: true,
    meshStep: 'ovault_mesh_confirmed' as const,
  }
  const finalizeCall = params.phase2FinalizeCalls[0]
  if (!finalizeCall) return defaultStatus
  const finalizeInfo = extractFinalizePhase2Info(finalizeCall.data)
  if (!finalizeInfo?.creatorToken) return defaultStatus

  const bridgeToken = finalizeInfo.creatorToken
  const expectedSolanaAmount =
    finalizeInfo.depositAmount && finalizeInfo.depositAmount > 0n
      ? (finalizeInfo.depositAmount * SOLANA_RESERVE_PERCENT_BPS) / BPS_DENOMINATOR
      : null
  const solanaOvault = isPlainObject(params.solanaOvault) ? params.solanaOvault : {}
  const assetMintOrigin =
    typeof solanaOvault.assetMintOrigin === 'string' && solanaOvault.assetMintOrigin.trim()
      ? solanaOvault.assetMintOrigin.trim()
      : 'existing'
  // Never trust session-persisted hints from client payloads.
  // Compatibility hints used for OVault gating must come from trusted server config.
  const mintCompatibilityHints = readSolanaOvaultMintCompatibilityHintsFromEnv()
  const hasMintCompatibilityHints = Object.values(mintCompatibilityHints).some((value) => value !== null)

  const origin = getCanonicalOrigin(params.req)
  const internalRegistrationSecret = String(
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
      process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
      '',
  ).trim()
  if (!internalRegistrationSecret) {
    throw new Error(
      'Solana preflight failed: DEPLOY_SOLANA_REGISTRATION_SECRET is required for internal registration checks.',
    )
  }
  const routePath = '/api/deploy/registerSolanaBridgeToken'
  const failures: string[] = []
  try {
    const body: Record<string, unknown> = {
      bridgeToken,
      batcherAddress: getAddress(finalizeCall.to),
      buildOnly: true,
      assetMintOrigin,
      enforceCompatibility: true,
    }
    if (hasMintCompatibilityHints) body.mintCompatibilityHints = mintCompatibilityHints
    if (expectedSolanaAmount && expectedSolanaAmount > 0n) {
      body.creatorToken = bridgeToken
      body.expectedSolanaAmount = expectedSolanaAmount.toString()
    }
    const trustedInternalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CV-Solana-Registration-Secret': internalRegistrationSecret,
    }
    const response = await fetch(`${origin}${routePath}`, {
      method: 'POST',
      headers: trustedInternalHeaders,
      body: JSON.stringify(body),
    })
    const rawBody = await response.text().catch(() => '')
    const json = rawBody ? (JSON.parse(rawBody) as ApiEnvelope<any>) : null
    if (response.ok && json?.success) {
      const data = json.data ?? {}
      const existingMintCompatible = data?.existingMintCompatible === true
      const depositEligible = data?.depositEligible === true
      const redeemEligible = data?.redeemEligible === true
      if (!existingMintCompatible || !depositEligible || !redeemEligible) {
        failures.push(
          `${routePath} ovault eligibility: existingMintCompatible=${String(data?.existingMintCompatible)} ` +
            `depositEligible=${String(data?.depositEligible)} redeemEligible=${String(data?.redeemEligible)}`,
        )
      } else {
        return {
          existingMintCompatible,
          depositEligible,
          redeemEligible,
          assetPeerSet: data?.assetPeerSet === false ? false : true,
          sharePeerSet: data?.sharePeerSet === false ? false : true,
          meshStep: 'ovault_mesh_confirmed',
        }
      }
    } else {
      failures.push(
        `${routePath} failed (${response.status}): ${json?.error ? String(json.error) : rawBody.slice(0, 160)}`,
      )
    }
  } catch (error) {
    failures.push(`${routePath} request_failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  throw new Error(`Solana preflight failed: ${failures.join(' | ')}`)
}

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 512 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  let upperBound = Number.isFinite(count) ? count : 0
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = Math.max(upperBound, next)
  } catch {
    // ignore: not all contract versions expose nextOwnerIndex
  }
  if (!Number.isFinite(upperBound) || upperBound <= 0) return null

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    let b: Hex
    try {
      b = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as Hex
    } catch {
      continue
    }
    if (String(b).toLowerCase() === expected) return i
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const authHeader = readDeployAuthFromRequest(req)
  if (!authHeader?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }
  const limiter = checkRateLimit(
    rateLimitKey('deploy-session-continue', authHeader.address.toLowerCase()),
    RATE_LIMITS.deploySessionContinue,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many continue attempts' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<ContinueRequest>(req, { maxBytes: 8_192 })
  const sessionId = normalizeDeploySessionId(body?.sessionId)
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing or invalid sessionId' } satisfies ApiEnvelope<null>)

  // Best-effort stage context for server-side revert debugging (persisted to DB payload only).
  let attemptedStage: string | null = null
  let attemptedCalls: Array<{ to: Address; value: bigint; data: Hex }> | null = null

  let rec!: NonNullable<Awaited<ReturnType<typeof getDeploySessionById>>>
  let sessionAddress!: Address
  try {
    const access = await loadAuthorizedDeploySession({
      req,
      sessionId,
      getDeploySessionById,
    })
    rec = access.rec
    sessionAddress = access.sessionAddress
  } catch (error) {
    if (error instanceof DeploySessionAccessError) {
      return res.status(error.status).json({ success: false, error: error.message } satisfies ApiEnvelope<null>)
    }
    throw error
  }

  // Check session not in terminal state
  if (['cancelled', 'failed', 'completed'].includes(rec.step)) {
    return res.status(400).json({ success: false, error: `Session already ${rec.step}` } satisfies ApiEnvelope<null>)
  }

  if (isSessionExpired(rec.expiresAt)) {
    const expiredAt = new Date().toISOString()
    try {
      await updateDeploySession({
        id: rec.id,
        step: 'failed',
        lastError: SESSION_EXPIRED_RESTART_REQUIRED,
        payloadPatch: {
          [SESSION_EXPIRED_AT_KEY]: expiredAt,
          [SESSION_EXPIRED_REASON_KEY]: SESSION_EXPIRED_RESTART_REQUIRED,
        },
      })
    } catch {
      // Best-effort expiry marker; still return actionable response.
    }
    return res.status(410).json({
      success: false,
      error: 'Session expired. Please restart deploy session.',
    } satisfies ApiEnvelope<null>)
  }

  try {
    // Server signs userops using the deploy-session owner.
    // Deploy sessions require a managed Privy signer wallet id.
    const payload = asPayloadObject(rec.payload)
    const erc7712Grant = parseGrant(payload?.erc7712Grant)
    const deploySignerWalletIdFromPayload =
      typeof payload?.deploySignerWalletId === 'string'
        ? payload.deploySignerWalletId.trim()
        : ''
    const deploySignerWalletIdFromRecord =
      typeof (rec as any)?.sessionSignerWalletId === 'string'
        ? String((rec as any).sessionSignerWalletId).trim()
        : ''
    const deploySignerWalletId = deploySignerWalletIdFromPayload || deploySignerWalletIdFromRecord
    if (!deploySignerWalletId) throw new Error('deploy_signer_wallet_unavailable')
    const persistSessionOwner =
      payload?.persistSessionOwner === true ||
      (payload?.persistSessionOwner == null && Boolean(deploySignerWalletId) && shouldPersistManagedSessionOwner())
    const sessionSigner = getAddress(rec.sessionSigner)
    const ownerAccount = toAccount({
      address: sessionSigner,
      sign: async ({ hash }: { hash: Hex }) => {
        return (await secp256k1SignHash({ walletId: deploySignerWalletId, hash })) as Hex
      },
      signTransaction: async () => {
        throw new Error('privy_sign_transaction_unsupported')
      },
      signMessage: async ({ message }: { message: SignableMessage }) => {
        const msg =
          typeof message === 'string'
            ? message
            : typeof message.raw === 'string'
              ? message.raw
              : `0x${Buffer.from(message.raw).toString('hex')}`
        const out = await walletRpc<any>({
          walletId: deploySignerWalletId,
          method: 'personal_sign',
          rpcParams: { message: msg, encoding: 'hex' },
        })
        const sig = String(out?.data?.signature ?? '').trim()
        if (!/^0x[0-9a-fA-F]+$/.test(sig)) throw new Error('privy_personal_sign_invalid_signature')
        return sig as Hex
      },
      signTypedData: async () => {
        throw new Error('privy_sign_typed_data_unsupported')
      },
    })
    const smartWallet = getAddress(rec.smartWallet)
    const ownerIndex = await findOwnerIndex({
      publicClient: createPublicClient({ chain: base, transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()) }),
      smartWallet,
      ownerAddress: sessionSigner,
      maxScan: 512,
    })
    if (ownerIndex === null) throw new Error('session_signer_not_installed')

    const publicClient = createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
    })

    const origin = getCanonicalOrigin(req)
    const bundlerEndpoint = getBundlerEndpoint(origin)

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const transport = http(bundlerEndpoint.url, bundlerEndpoint.viaProxy
      ? {
          fetchOptions: {
            headers: {
              'X-CV-Deploy-Session': deployToken,
              'X-CV-Deploy-Session-Signature': deploySig,
            },
          },
        }
      : undefined)

    const paymasterClient = createPaymasterClient({ transport })
    const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

    const account = await toCoinbaseSmartAccount({
      client: publicClient as any,
      address: smartWallet,
      owners: [ownerAccount as any],
      ownerIndex,
      version: '1',
    })

    const toBigInt = (v: any): bigint => {
      if (typeof v === 'bigint') return v
      if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v))
      if (typeof v === 'string') {
        const s = v.trim()
        if (!s) return 0n
        if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s)
        return BigInt(s)
      }
      return 0n
    }

    const normalizeCalls = (raw: unknown): Array<{ to: Address; value: bigint; data: Hex }> => {
      if (!Array.isArray(raw)) return []
      const out: Array<{ to: Address; value: bigint; data: Hex }> = []
      for (const entry of raw) {
        const c = entry as any
        if (!c || typeof c !== 'object') continue
        const data = typeof c.data === 'string' ? c.data : ''
        if (!data.startsWith('0x')) continue
        try {
          out.push({
            to: getAddress(c.to),
            value: toBigInt(c.value ?? 0),
            data: data as Hex,
          })
        } catch {
          // Skip malformed calls; required-stage checks below will prevent false completion.
        }
      }
      return out
    }

    const rawPhase1Calls = Array.isArray(payload.phase1Calls) ? payload.phase1Calls : []
    const phase1Calls = normalizeCalls(rawPhase1Calls)
    const phase1CoreCalls = phase1Calls.length > 1 ? phase1Calls.slice(0, 1) : phase1Calls
    const phase1FinalizeCalls = phase1Calls.length > 1 ? phase1Calls.slice(1) : []
    const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
    const expectedStages = isPlainObject(payload.expectedStages) ? payload.expectedStages : {}
    const rawPhase2FinalizeCalls = Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : []
    const hasPhase2Finalize = expectedStages.hasPhase2Finalize === true || rawPhase2FinalizeCalls.length > 0
    const phase2FinalizeCalls = normalizeCalls(rawPhase2FinalizeCalls)
    const rawPhase3Calls = Array.isArray(payload.phase3Calls) ? payload.phase3Calls : []
    const rawPhase4Calls = Array.isArray(payload.phase4Calls) ? payload.phase4Calls : []
    const hasPhase3 = expectedStages.hasPhase3 === true || rawPhase3Calls.length > 0
    const hasPhase4 = expectedStages.hasPhase4 === true || rawPhase4Calls.length > 0
    const phase3Calls = normalizeCalls(rawPhase3Calls)
    const phase4Calls = normalizeCalls(rawPhase4Calls)
    if (hasPhase2Finalize && phase2FinalizeCalls.length === 0) throw new Error('phase2_finalize_calls_invalid')
    if (hasPhase3 && phase3Calls.length === 0) throw new Error('phase3_calls_invalid')
    if (hasPhase4 && phase4Calls.length === 0) throw new Error('phase4_calls_invalid')
    const solanaOvaultConfig = isPlainObject(payload.solanaOvault) ? payload.solanaOvault : {}

    const isInFlight = [
      'phase1_sent',
      'phase1_finalize_sent',
      'phase2_core_sent',
      'phase2_sent',
      'phase3_sent',
      'phase4_sent',
      'cleanup_sent',
    ].includes(rec.step)

    // Cleanup call (remove session owner). For managed owners, this can be skipped to reduce repeated prompts.
    const removeOwnerCall = (() => {
      const ownerBytes = asOwnerBytes(sessionSigner)
      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(ownerIndex), ownerBytes],
      })
      return { to: smartWallet, value: 0n, data } as const
    })()

    const hasPostPhase2 = hasPhase3 || hasPhase4
    const hasOvaultMeshStage = solanaOvaultConfig.enabled === true && hasPostPhase2
    const enforcePhase2InvariantGate = isTruthyEnv(process.env.DEPLOY_ENFORCE_PHASE2_INVARIANTS, true)
    const defaultPayoutRecipientMode =
      String(process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT_MODE ?? '').trim().toLowerCase() === 'payout_router'
        ? 'payout_router'
        : 'gauge'
    const defaultPayoutRecipient =
      typeof process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT === 'string' &&
      isAddress(process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT)
        ? getAddress(process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT as Address)
        : null
    const phase2ReplayState =
      phase2CoreCalls.length > 0 || hasPhase2Finalize
        ? await readPhase2ReplayState({
            publicClient,
            phase2FinalizeCalls,
          })
        : {
            phase2CoreAlreadyDeployed: false,
            phase2FinalizeAlreadyCompleted: false,
          }
    const shouldSkipPhase2Core = phase2CoreCalls.length > 0 && phase2ReplayState.phase2CoreAlreadyDeployed
    const shouldSkipPhase2Finalize = hasPhase2Finalize && phase2ReplayState.phase2FinalizeAlreadyCompleted
    const markReplaySkip = async (phase: 'phase2Core' | 'phase2Finalize'): Promise<void> => {
      const atKey = phase === 'phase2Core' ? REPLAY_SKIP_PHASE2_CORE_AT_KEY : REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY
      const reasonKey =
        phase === 'phase2Core' ? REPLAY_SKIP_PHASE2_CORE_REASON_KEY : REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY
      if (typeof payload?.[atKey] === 'string' && payload[atKey].trim()) return
      const reason =
        phase === 'phase2Core'
          ? 'onchain_phase2_core_already_deployed'
          : 'onchain_phase2_finalize_already_completed'
      const patch = {
        [atKey]: new Date().toISOString(),
        [reasonKey]: reason,
      }
      await updateDeploySession({
        id: rec.id,
        payloadPatch: patch,
      })
      payload[atKey] = patch[atKey]
      payload[reasonKey] = reason
    }

    const assertPhase2InvariantGate = async (): Promise<void> => {
      if (!enforcePhase2InvariantGate || !hasPhase2Finalize) return
      const result = await verifyDeployPhase2Invariants({
        publicClient,
        phase2FinalizeCalls,
        payload,
        defaultPayoutRecipientMode,
        defaultPayoutRecipient,
      })
      const gatePatch = {
        [PHASE2_INVARIANT_GATE_CHECKED_AT_KEY]: new Date().toISOString(),
        [PHASE2_INVARIANT_GATE_KEY]: result,
      }
      await updateDeploySession({
        id: rec.id,
        payloadPatch: gatePatch,
      })
      payload[PHASE2_INVARIANT_GATE_CHECKED_AT_KEY] = gatePatch[PHASE2_INVARIANT_GATE_CHECKED_AT_KEY]
      payload[PHASE2_INVARIANT_GATE_KEY] = gatePatch[PHASE2_INVARIANT_GATE_KEY]
      if (!result.checked || result.violations.length > 0) {
        const summary = result.violations.map((entry) => entry.code).join(',')
        throw new Error(`phase2_invariant_failed:${summary || 'unknown'}`)
      }
    }

    const sendNextAfterPhase2 = () => {
      if (hasPhase3) return sendStage('phase3_sent', phase3Calls, !hasPhase4)
      if (hasPhase4) return sendStage('phase4_sent', phase4Calls, true)
      return null
    }
    const sendStage = async (toStep: string, stageCalls: Array<{ to: Address; value: bigint; data: Hex }>, attachCleanup: boolean) => {
      if (toStep === 'phase4_sent') {
        const deploySig = signDeployToken(rec.deployToken)
        await ensureLaunchImageReady({
          req,
          sessionId: rec.id,
          sessionAddress: getAddress(rec.sessionAddress),
          payload,
          phase2FinalizeCalls,
          phase4Calls,
          deployToken: rec.deployToken,
          deployTokenSignature: deploySig,
          persistPayloadPatch: async (patch) => {
            await updateDeploySession({ id: rec.id, payloadPatch: patch })
            Object.assign(payload, patch)
          },
        })
      }

      const calls = [...stageCalls]
      const shouldAttachCleanup = attachCleanup && !persistSessionOwner
      const allowCleanupFallback = shouldAttachCleanup && toStep === 'phase4_sent'
      if (shouldAttachCleanup) calls.push(removeOwnerCall)

      await validateSponsoredSmartWalletCalls({
        sender: smartWallet,
        sessionAddress,
        calls,
        deploySessionOwner: sessionSigner,
      })

      const permissionCheck = validateCallsAgainstGrant({
        grant: erc7712Grant,
        calls,
        expectedChainId: 8453,
        expectedSessionId: rec.id,
      })
      if (!permissionCheck.ok) {
        return res.status(403).json({
          success: false,
          error: permissionCheck.reason ?? 'erc7712_permission_denied',
        } satisfies ApiEnvelope<null>)
      }

      const transitioned = await transitionDeploySession({
        id: rec.id,
        fromStep: rec.step,
        toStep: toStep as any,
        lastUserOpHash: null,
        lastTxHash: null,
        lastError: null,
        payloadPatch: { [stageUserOpHashKey(toStep)]: null },
      })
      if (!transitioned) {
        return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
      }
      attemptedStage = toStep
      attemptedCalls = calls
      const stageHashKey = stageUserOpHashKey(toStep)
      let lastUserOpHash: Hex
      let payloadPatch: Record<string, unknown> = { [stageHashKey]: null }
      try {
        lastUserOpHash = await sendUserOperation(bundlerClient, {
          account,
          calls,
          paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
        })
      } catch (err) {
        if (!allowCleanupFallback) throw err
        const cleanupFailureReason = truncateMessage(normalizeErrorMessage(err), 220)
        attemptedCalls = stageCalls
        lastUserOpHash = await sendUserOperation(bundlerClient, {
          account,
          calls: stageCalls,
          paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
        })
        payloadPatch = {
          [stageHashKey]: null,
          cleanupDeferredAt: new Date().toISOString(),
          cleanupDeferredReason: cleanupFailureReason,
        }
      }
      await updateDeploySession({
        id: rec.id,
        step: toStep as any,
        lastUserOpHash,
        lastTxHash: null,
        lastError: null,
        payloadPatch: { ...payloadPatch, [stageHashKey]: lastUserOpHash },
      })
      return res.status(200).json({ success: true, data: { id: rec.id, step: toStep, lastUserOpHash } } satisfies ApiEnvelope<any>)
    }
    const completeFrom = async (fromStep: string) => {
      const transitioned = await transitionDeploySession({
        id: rec.id,
        fromStep: fromStep as any,
        toStep: 'completed',
      })
      if (!transitioned) {
        return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
      }
      return res.status(200).json({
        success: true,
        data: {
          id: rec.id,
          step: 'completed',
        },
      } satisfies ApiEnvelope<any>)
    }

    const runOvaultMeshGate = async (fromStep: string) => {
      if (fromStep !== 'ovault_mesh_sent') {
        const markedSent = await transitionDeploySession({
          id: rec.id,
          fromStep: fromStep as any,
          toStep: 'ovault_mesh_sent',
          lastUserOpHash: null,
          lastTxHash: null,
          lastError: null,
        })
        if (!markedSent) {
          return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
        }
      }
      const ovault = await ensureOvaultPreflight({
        req,
        phase2FinalizeCalls,
        solanaOvault: payload.solanaOvault,
      })
      const markedConfirmed = await transitionDeploySession({
        id: rec.id,
        fromStep: 'ovault_mesh_sent',
        toStep: 'ovault_mesh_confirmed',
        lastError: null,
        payloadPatch: { ovault },
      })
      if (!markedConfirmed) {
        return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
      }
      return res.status(200).json({
        success: true,
        data: {
          id: rec.id,
          step: 'ovault_mesh_confirmed',
          ovault,
        },
      } satisfies ApiEnvelope<any>)
    }

    const runAfterPhase2 = async (fromStep: string) => {
      await assertPhase2InvariantGate()
      if (hasPostPhase2 && hasOvaultMeshStage && fromStep !== 'ovault_mesh_confirmed') {
        return runOvaultMeshGate(fromStep)
      }
      if (hasPostPhase2) return sendNextAfterPhase2()
      return completeFrom(fromStep)
    }

    const runFromPhase2 = async (fromStep: string) => {
      if (phase2CoreCalls.length > 0) {
        if (!shouldSkipPhase2Core) {
          const attachCleanup = !hasPhase2Finalize && !hasPostPhase2
          return sendStage('phase2_core_sent', phase2CoreCalls, attachCleanup)
        }
        await markReplaySkip('phase2Core')
      }
      if (hasPhase2Finalize) {
        if (!shouldSkipPhase2Finalize) {
          const attachCleanup = !hasPostPhase2
          return sendStage('phase2_sent', phase2FinalizeCalls, attachCleanup)
        }
        await markReplaySkip('phase2Finalize')
      }
      return runAfterPhase2(fromStep)
    }

    const runAfterPhase2Core = async (fromStep: string) => {
      if (hasPhase2Finalize) {
        if (!shouldSkipPhase2Finalize) {
          const attachCleanup = !hasPostPhase2
          return sendStage('phase2_sent', phase2FinalizeCalls, attachCleanup)
        }
        await markReplaySkip('phase2Finalize')
      }
      return runAfterPhase2(fromStep)
    }

    // Kick off whichever stage is next based on persisted step.
    // Note: we intentionally key off the persisted step (not call-array emptiness), because
    // the payload contains *all* calls for the full deploy.
    const runFromCreated = async () => {
      if (phase1CoreCalls.length > 0) {
        const attachCleanup =
          phase1FinalizeCalls.length === 0 &&
          phase2CoreCalls.length === 0 &&
          !hasPhase2Finalize &&
          !hasPostPhase2
        return sendStage('phase1_sent', phase1CoreCalls, attachCleanup)
      }
      if (phase2CoreCalls.length > 0 || hasPhase2Finalize || hasPostPhase2) {
        return runFromPhase2('created')
      }
      return null
    }

    const runFromPhase1Confirmed = async () => {
      if (phase1FinalizeCalls.length > 0) {
        const attachCleanup = phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2
        return sendStage('phase1_finalize_sent', phase1FinalizeCalls, attachCleanup)
      }
      return runFromPhase2('phase1_confirmed')
    }

    const runFromPhase1FinalizeConfirmed = async () => {
      return runFromPhase2('phase1_finalize_confirmed')
    }

    const runFromPhase2CoreConfirmed = async () => {
      return runAfterPhase2Core('phase2_core_confirmed')
    }

    if (rec.step === 'created') {
      const started = await runFromCreated()
      if (started) return started
    }
    if (rec.step === 'phase1_confirmed') {
      const started = await runFromPhase1Confirmed()
      if (started) return started
    }
    if (rec.step === 'phase1_finalize_confirmed') {
      const started = await runFromPhase1FinalizeConfirmed()
      if (started) return started
    }
    if (rec.step === 'phase2_core_confirmed') {
      const started = await runFromPhase2CoreConfirmed()
      if (started) return started
    }
    if (rec.step === 'phase2_confirmed' && hasPostPhase2) {
      const started = await runAfterPhase2('phase2_confirmed')
      if (started) return started
    }
    if (rec.step === 'phase2_confirmed' && !hasPostPhase2) {
      return await runAfterPhase2('phase2_confirmed')
    }
    if (rec.step === 'ovault_mesh_sent') {
      return await runOvaultMeshGate('ovault_mesh_sent')
    }
    if (rec.step === 'ovault_mesh_confirmed' && hasPostPhase2) {
      const started = await sendNextAfterPhase2()
      if (started) return started
    }
    if (rec.step === 'phase3_confirmed' && hasPhase4) {
      return await sendStage('phase4_sent', phase4Calls, true)
    }
    if (rec.step === 'phase3_confirmed' && !hasPhase4) {
      return await completeFrom('phase3_confirmed')
    }
    if (rec.step === 'phase4_confirmed') {
      return await completeFrom('phase4_confirmed')
    }

    if (isInFlight) {
      return res.status(409).json({ success: false, error: 'Already in progress' } satisfies ApiEnvelope<null>)
    }

    return res.status(409).json({
      success: false,
      error: 'No deploy stage available from current step',
    } satisfies ApiEnvelope<null>)
  } catch (err: any) {
    const msg = normalizeErrorMessage(err)
    const pretty = truncateMessage(msg)
    let serializedErr = ''
    try {
      serializedErr = JSON.stringify(err)
    } catch {
      serializedErr = ''
    }
    const debug = buildUserOpErrorDebug({
      err,
      sessionId: rec.id,
      stage: attemptedStage,
      calls: attemptedCalls,
    })
    const revertLike =
      isOnchainRevertLike(msg) || isOnchainRevertLike(serializedErr) || Boolean(debug.revertData || debug.selector)
    const persistFailure = async () => {
      try {
        await updateDeploySession({
          id: rec.id,
          step: 'failed',
          lastError: pretty,
          ...(revertLike ? { payloadPatch: { lastErrorDebug: debug } } : {}),
        })
      } catch {
        // ignore
      }
    }
    if (
      msg === 'deploy_signer_wallet_unavailable' ||
      msg === 'session_signer_unavailable' ||
      msg === 'session_signer_key_missing' ||
      msg === 'session_owner_unavailable' ||
      msg === 'session_owner_key_missing'
    ) {
      return res.status(409).json({
        success: false,
        error: 'Session signer credentials unavailable. Please restart deploy session.',
      } satisfies ApiEnvelope<null>)
    }
    if (msg === 'session_signer_not_installed' || msg === 'session_owner_not_installed') {
      return res.status(409).json({
        success: false,
        error:
          'Deploy-session signer is not installed on the canonical smart wallet. Approve the one-time add-owner transaction, then retry.',
      } satisfies ApiEnvelope<null>)
    }
    if (msg === 'deploy_payload_invalid' || msg.endsWith('_calls_invalid')) {
      return res.status(409).json({
        success: false,
        error: 'Deploy session payload is invalid or missing required stage calls. Please restart deploy session.',
      } satisfies ApiEnvelope<null>)
    }
    if (msg === 'cdp_endpoint_missing_on_vercel') {
      return res.status(503).json({
        success: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint; do not rely on same-origin /api/paymaster for server-side deploy-session calls.',
      } satisfies ApiEnvelope<null>)
    }
    if (msg.startsWith('phase4 image gate failed:')) {
      return res.status(409).json({
        success: false,
        error: msg,
      } satisfies ApiEnvelope<null>)
    }
    if (msg.startsWith('phase2_invariant_failed:')) {
      await persistFailure()
      return res.status(409).json({
        success: false,
        error: msg,
      } satisfies ApiEnvelope<null>)
    }
    if (revertLike) {
      logger.warn('deploy session continue reverted', pretty)
      await persistFailure()
      return res.status(409).json({
        success: false,
        error: `Deploy execution reverted: ${pretty}${debug.errorName ? ` (${debug.errorName})` : ''}`,
      } satisfies ApiEnvelope<null>)
    }
    logger.error('deploy session continue failed', pretty)
    await persistFailure()
    return res.status(500).json({ success: false, error: 'Internal server error' } satisfies ApiEnvelope<null>)
  }
}
