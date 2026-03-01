import type { VercelRequest, VercelResponse } from '@vercel/node'

import { decodeFunctionData, getAddress, isAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { privateKeyToAccount, toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { decryptWithSecret, getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { buildUserOpErrorDebug } from '../../../../server/_lib/userOpRevertDebug.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { parseGrant, validateCallsAgainstGrant } from '../../../../server/_lib/erc7712Permissions.js'
import { readSolanaOvaultMintCompatibilityHintsFromEnv } from '../../../../server/_lib/solanaOvaultCompatibility.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StatusRequest = { sessionId: string }

const CONCURRENT_MODIFICATION = 'concurrent_modification'
const STAGE_USEROP_HASH_PREFIX = 'stageUserOpHash_'
const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const SOLANA_RESERVE_PERCENT_BPS = 3_000n
const BPS_DENOMINATOR = 10_000n

function stageUserOpHashKey(step: string): string {
  return `${STAGE_USEROP_HASH_PREFIX}${step}`
}

function asHexHash(value: unknown): Hex | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{64}$/.test(raw) ? (raw as Hex) : null
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
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
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, true)
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

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

const CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI = [
  {
    type: 'function',
    name: 'solanaBridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const SOLANA_BRIDGE_ADAPTER_VIEW_ABI = [
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
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

function asOwnerBytes(owner: Address): Hex {
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

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

function inferRequestOrigin(req: VercelRequest): string | null {
  const host = headerValue(req.headers['x-forwarded-host'] as string | string[] | undefined) ||
    headerValue(req.headers.host as string | string[] | undefined)
  if (!host) return null
  const protoRaw = headerValue(req.headers['x-forwarded-proto'] as string | string[] | undefined).toLowerCase()
  const proto = protoRaw.startsWith('https') ? 'https' : 'http'
  try {
    return new URL(`${proto}://${host}`).origin
  } catch {
    return null
  }
}

function parseConfiguredOrigin(value: string): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

function readAdditionalSolanaRegistrationOrigins(): string[] {
  const raw =
    String(process.env.DEPLOY_SOLANA_REGISTRATION_ORIGINS ?? '').trim() ||
    String(process.env.SOLANA_REGISTRATION_ORIGINS ?? '').trim()
  if (!raw) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw.split(/[,\s]+/)) {
    const origin = parseConfiguredOrigin(entry)
    if (!origin) continue
    const key = origin.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(origin)
  }
  return out
}

type SolanaPreflightRoutePath =
  | '/api/deploy/setupSolanaOvaultMesh'
  | '/api/deploy/registerSolanaBridgeToken'

type SolanaPreflightRouteMode =
  | 'ovault_first'
  | 'legacy_first'
  | 'ovault_only'
  | 'legacy_only'

function readSolanaOvaultKillSwitchEnabled(): boolean {
  const raw =
    process.env.DEPLOY_SOLANA_OVAULT_KILL_SWITCH ??
    process.env.SOLANA_OVAULT_KILL_SWITCH
  return isTruthyEnv(raw, false)
}

function readSolanaPreflightRouteMode(): SolanaPreflightRouteMode {
  if (readSolanaOvaultKillSwitchEnabled()) return 'legacy_only'
  const raw = String(
    process.env.DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE ??
      process.env.SOLANA_PREFLIGHT_ROUTE_MODE ??
      '',
  )
    .trim()
    .toLowerCase()

  if (!raw) return 'ovault_first'
  if (raw === 'legacy' || raw === 'legacy_only' || raw === 'rollback') return 'legacy_only'
  if (raw === 'legacy_first') return 'legacy_first'
  if (raw === 'ovault_only') return 'ovault_only'
  if (raw === 'ovault_first' || raw === 'default') return 'ovault_first'
  return 'ovault_first'
}

function resolveSolanaPreflightRoutes(mode: SolanaPreflightRouteMode): {
  primary: SolanaPreflightRoutePath
  fallback: SolanaPreflightRoutePath | null
} {
  switch (mode) {
    case 'legacy_only':
      return {
        primary: '/api/deploy/registerSolanaBridgeToken',
        fallback: null,
      }
    case 'legacy_first':
      return {
        primary: '/api/deploy/registerSolanaBridgeToken',
        fallback: '/api/deploy/setupSolanaOvaultMesh',
      }
    case 'ovault_only':
      return {
        primary: '/api/deploy/setupSolanaOvaultMesh',
        fallback: null,
      }
    case 'ovault_first':
    default:
      return {
        primary: '/api/deploy/setupSolanaOvaultMesh',
        fallback: '/api/deploy/registerSolanaBridgeToken',
      }
  }
}

function dedupeOrigins(origins: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const origin of origins) {
    const key = origin.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(origin)
  }
  return out
}

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
} | null {
  for (const abi of [CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI, CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        depositAmount?: bigint | string | number
      } | null
      const creatorTokenCandidate = params?.creatorToken && isAddress(params.creatorToken)
        ? getAddress(params.creatorToken as Address)
        : null
      const creatorToken =
        creatorTokenCandidate && creatorTokenCandidate.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
          ? creatorTokenCandidate
          : null
      if (!creatorToken) continue
      return {
        creatorToken,
        depositAmount: parseBigIntLike(params?.depositAmount),
      }
    } catch {
      continue
    }
  }
  return null
}

async function ensureSolanaRouteReadyForPhase3(params: {
  req: VercelRequest
  publicClient: any
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
  solanaOvault?: unknown
}): Promise<void> {
  const finalizeCall = params.phase2FinalizeCalls[0]
  if (!finalizeCall) return

  const batcherAddress = getAddress(finalizeCall.to)
  const finalizeInfo = extractFinalizePhase2Info(finalizeCall.data)
  if (!finalizeInfo?.creatorToken) return
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
  const mintCompatibilityHints = isPlainObject(solanaOvault.mintCompatibilityHints)
    ? solanaOvault.mintCompatibilityHints
    : readSolanaOvaultMintCompatibilityHintsFromEnv()

  const [adapterRaw, destinationRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
        functionName: 'solanaBridgeAdapter',
      })
      .catch(() => ZERO_ADDRESS as Address),
    params.publicClient
      .readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
        functionName: 'solanaDestination',
      })
      .catch(() => ZERO_BYTES32 as Hex),
  ])
  const adapter = getAddress((adapterRaw as Address) || ZERO_ADDRESS)
  const destination = ((destinationRaw as Hex) || ZERO_BYTES32).toLowerCase()
  const solanaEnabled =
    adapter.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
    destination !== ZERO_BYTES32.toLowerCase()
  if (!solanaEnabled) return

  const registered = await params.publicClient
    .readContract({
      address: adapter,
      abi: SOLANA_BRIDGE_ADAPTER_VIEW_ABI,
      functionName: 'isRegistered',
      args: [bridgeToken],
    })
    .then((v: unknown) => Boolean(v))
    .catch(() => null)

  // Prefer the canonical app origin for internal API calls (avoids Vercel preview auth gates).
  // Fall back to the request origin only if it's the production domain.
  const canonicalOrigin = getCanonicalOrigin(params.req)
  const requestOrigin = inferRequestOrigin(params.req)
  const isPreviewOrigin = requestOrigin && /\.vercel\.app$/i.test(new URL(requestOrigin).hostname)
  const defaultOrigins = isPreviewOrigin
    ? [canonicalOrigin].filter((o): o is string => Boolean(o))
    : [requestOrigin, canonicalOrigin].filter((o): o is string => Boolean(o))
  const configuredOrigins = readAdditionalSolanaRegistrationOrigins()
  const candidateOrigins = dedupeOrigins([...configuredOrigins, ...defaultOrigins])
  if (candidateOrigins.length === 0) {
    throw new Error(
      'Solana preflight failed: no registration origin available. Configure CANONICAL_ORIGIN or DEPLOY_SOLANA_REGISTRATION_ORIGINS.',
    )
  }
  if (registered !== true && (!expectedSolanaAmount || expectedSolanaAmount <= 0n)) {
    throw new Error(
      'Solana preflight failed: missing finalize deposit amount for reserve checks.',
    )
  }
  const cookie = headerValue(params.req.headers.cookie as string | string[] | undefined)
  const authz = headerValue(params.req.headers.authorization as string | string[] | undefined)
  const internalRegistrationSecret = String(
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
      process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
      '',
  ).trim()
  const routeMode = readSolanaPreflightRouteMode()
  const routes = resolveSolanaPreflightRoutes(routeMode)
  const tryRegister = async (
    origin: string,
    routePath: SolanaPreflightRoutePath,
  ): Promise<{ ok: boolean; statusCode: number | null; failure: string | null }> => {
    try {
      const registerUrl = `${origin}${routePath}`
      const payload: Record<string, unknown> = {
        bridgeToken,
        buildOnly: registered === true,
        batcherAddress,
        assetMintOrigin,
        enforceCompatibility: true,
      }
      if (mintCompatibilityHints) payload.mintCompatibilityHints = mintCompatibilityHints
      // Only force Meteora payload generation while the bridge token is not yet registered.
      if (registered !== true) {
        payload.creatorToken = bridgeToken
        payload.expectedSolanaAmount = expectedSolanaAmount?.toString()
      }
      const registerRes = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(authz ? { Authorization: authz } : {}),
          ...(internalRegistrationSecret
            ? { 'X-CV-Solana-Registration-Secret': internalRegistrationSecret }
            : {}),
        },
        body: JSON.stringify(payload),
      })
      const rawBody = await registerRes.text().catch(() => '')
      let registerJson: ApiEnvelope<any> | null = null
      try {
        registerJson = rawBody ? (JSON.parse(rawBody) as ApiEnvelope<any>) : null
      } catch {
        registerJson = null
      }
      if (registerRes.ok && registerJson?.success) {
        const data = registerJson?.data ?? null
        const existingMintCompatible = data?.existingMintCompatible === true
        const depositEligible = data?.depositEligible === true
        const redeemEligible = data?.redeemEligible === true
        if (!existingMintCompatible || !depositEligible || !redeemEligible) {
          const blockersRaw = data?.mintCompatibility?.blockers
          const blockers =
            Array.isArray(blockersRaw) && blockersRaw.length > 0
              ? blockersRaw.map((v: unknown) => String(v)).join(' ')
              : null
          return {
            ok: false,
            statusCode: registerRes.status,
            failure:
              `${origin}${routePath} (ovault eligibility): ` +
              `existingMintCompatible=${String(data?.existingMintCompatible)} ` +
              `depositEligible=${String(data?.depositEligible)} ` +
              `redeemEligible=${String(data?.redeemEligible)}` +
              (blockers ? ` blockers=${blockers}` : ''),
          }
        }
        return { ok: true, statusCode: registerRes.status, failure: null }
      }
      const detail =
        registerJson?.error
          ? String(registerJson.error)
          : rawBody
            ? rawBody.slice(0, 240)
            : `http_${registerRes.status}`
      return {
        ok: false,
        statusCode: registerRes.status,
        failure: `${origin}${routePath} (${registerRes.status}): ${detail}`,
      }
    } catch {
      return { ok: false, statusCode: null, failure: `${origin}${routePath}: request_failed` }
    }
  }
  const failures: string[] = []
  for (const origin of candidateOrigins) {
    const primary = await tryRegister(origin, routes.primary)
    if (primary.ok) return
    if (primary.failure) failures.push(primary.failure)
    // Fallback route applies only when primary route appears unavailable in this runtime.
    if (routes.fallback && (primary.statusCode === 404 || primary.statusCode === 405 || primary.statusCode === null)) {
      const fallback = await tryRegister(origin, routes.fallback)
      if (fallback.ok) return
      if (fallback.failure) failures.push(fallback.failure)
    }
  }
  throw new Error(
    `Solana preflight failed (mode=${routeMode}): ${failures.join(' | ') || 'setupSolanaOvaultMesh/registerSolanaBridgeToken call failed.'}`,
  )
}

async function getOwnerAccount(rec: any) {
  const payload = asPayloadObject(rec.payload)
  const deploySignerWalletId =
    typeof payload?.deploySignerWalletId === 'string'
      ? payload.deploySignerWalletId.trim()
      : typeof payload?.agentWalletId === 'string'
        ? payload.agentWalletId.trim()
        : ''
  const sessionOwner = getAddress(rec.sessionOwner)
  const ownerAccount = deploySignerWalletId
    ? toAccount({
        address: sessionOwner,
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
    : (() => {
        if (!rec.sessionOwnerKeyEnc) throw new Error('session_owner_unavailable')
        const pk = decryptWithSecret(rec.sessionOwnerKeyEnc) as Hex
        return privateKeyToAccount(pk)
      })()
  return { ownerAccount, sessionOwner }
}

async function advanceDeploySession(rec: any, req: VercelRequest): Promise<void> {
  const step = String(rec.step ?? '')
  if (
    ![
      'phase1_sent',
      'phase1_confirmed',
      'phase1_finalize_sent',
      'phase1_finalize_confirmed',
      'phase2_core_sent',
      'phase2_core_confirmed',
      'phase2_sent',
      'phase2_confirmed',
      'phase3_sent',
      'phase3_confirmed',
      'phase4_sent',
      'phase4_confirmed',
      'cleanup_sent',
    ].includes(step)
  ) {
    return
  }
  const receiptBackedSteps = ['phase1_sent', 'phase1_finalize_sent', 'phase2_core_sent', 'phase2_sent', 'phase3_sent', 'phase4_sent', 'cleanup_sent']
  const needsReceipt = receiptBackedSteps.includes(step)

  const origin = getCanonicalOrigin(req)
  const bundlerEndpoint = getBundlerEndpoint(origin)
  const transport = http(bundlerEndpoint.url)

  const publicClient = createPublicClient({
    chain: base,
    transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
  })
  const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

  let txHash: Hex | undefined
  const payload = asPayloadObject(rec.payload)

  if (step === 'cleanup_sent') {
    const transitioned = await transitionDeploySession({
      id: rec.id,
      fromStep: 'cleanup_sent',
      toStep: 'cancelled',
      lastTxHash: txHash,
      lastError: null,
    })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  const deploySignerWalletId =
    typeof payload?.deploySignerWalletId === 'string'
      ? payload.deploySignerWalletId.trim()
      : typeof payload?.agentWalletId === 'string'
        ? payload.agentWalletId.trim()
        : ''
  const persistSessionOwner =
    payload?.persistSessionOwner === true ||
    (payload?.persistSessionOwner == null && Boolean(deploySignerWalletId) && shouldPersistManagedSessionOwner())
  const erc7712Grant = parseGrant(payload?.erc7712Grant)
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
        // Skip malformed calls; required-stage checks below prevent false completion.
      }
    }
    return out
  }
  const rawPhase1Calls = Array.isArray(payload.phase1Calls) ? payload.phase1Calls : []
  const phase1Calls = normalizeCalls(rawPhase1Calls)
  const phase1FinalizeCalls = phase1Calls.length > 1 ? phase1Calls.slice(1) : []
  const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
  const expectedStages = isPlainObject(payload.expectedStages) ? payload.expectedStages : {}
  const rawPhase2FinalizeCalls = Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : []
  const rawLegacyPhase2Calls = Array.isArray(payload.phase2Calls) ? payload.phase2Calls : []
  const rawSelectedPhase2FinalizeCalls = rawPhase2FinalizeCalls.length > 0 ? rawPhase2FinalizeCalls : rawLegacyPhase2Calls
  const hasPhase2Finalize =
    expectedStages.hasPhase2Finalize === true || rawSelectedPhase2FinalizeCalls.length > 0
  const phase2FinalizeCalls = normalizeCalls(rawSelectedPhase2FinalizeCalls)
  const rawPhase3Calls = Array.isArray(payload.phase3Calls) ? payload.phase3Calls : []
  const rawPhase4Calls = Array.isArray(payload.phase4Calls) ? payload.phase4Calls : []
  const hasPhase3 = expectedStages.hasPhase3 === true || rawPhase3Calls.length > 0
  const hasPhase4 = expectedStages.hasPhase4 === true || rawPhase4Calls.length > 0
  const phase3Calls = normalizeCalls(rawPhase3Calls)
  const phase4Calls = normalizeCalls(rawPhase4Calls)
  if (hasPhase2Finalize && phase2FinalizeCalls.length === 0) throw new Error('phase2_finalize_calls_invalid')
  if (hasPhase3 && phase3Calls.length === 0) throw new Error('phase3_calls_invalid')
  if (hasPhase4 && phase4Calls.length === 0) throw new Error('phase4_calls_invalid')
  const hasPostPhase2 = hasPhase3 || hasPhase4

  type AuthedCtx = {
    bundler: any
    paymasterClient: any
    account: any
    removeOwnerCall: { to: Address; value: bigint; data: Hex }
  }
  let ctx: AuthedCtx | null = null
  const getCtx = async (): Promise<AuthedCtx> => {
    if (ctx) return ctx
    const { ownerAccount, sessionOwner } = await getOwnerAccount(rec)
    const smartWallet = getAddress(rec.smartWallet)
    const ownerIndex = await findOwnerIndex({
      publicClient,
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 512,
    })
    if (ownerIndex === null) throw new Error('session_owner_not_installed')

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const authedTransport = http(bundlerEndpoint.url, bundlerEndpoint.viaProxy
      ? {
          fetchOptions: {
            headers: {
              'X-CV-Deploy-Session': deployToken,
              'X-CV-Deploy-Session-Signature': deploySig,
            },
          },
        }
      : undefined)
    const paymasterClient = createPaymasterClient({ transport: authedTransport })
    const bundler = createBundlerClient({ client: publicClient as any, transport: authedTransport })
    const account = await toCoinbaseSmartAccount({
      client: publicClient as any,
      address: smartWallet,
      owners: [ownerAccount as any],
      ownerIndex,
      version: '1',
    })
    const removeOwnerCall = (() => {
      const ownerBytes = asOwnerBytes(sessionOwner)
      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(ownerIndex), ownerBytes],
      })
      return { to: smartWallet, value: 0n, data } as const
    })()

    ctx = { bundler, paymasterClient, account, removeOwnerCall }
    return ctx
  }

  const startStage = async (
    fromStep: string,
    toStep: string,
    calls: Array<{ to: Address; value: bigint; data: Hex }>,
    attachCleanup: boolean,
  ) => {
    const fullCalls = [...calls]
    const shouldAttachCleanup = attachCleanup && !persistSessionOwner
    if (shouldAttachCleanup) fullCalls.push((await getCtx()).removeOwnerCall)

    const permissionCheck = validateCallsAgainstGrant({
      grant: erc7712Grant,
      calls: fullCalls,
      expectedChainId: 8453,
      expectedSessionId: rec.id,
    })
    if (!permissionCheck.ok) throw new Error(permissionCheck.reason ?? 'erc7712_permission_denied')

    const stageKey = stageUserOpHashKey(toStep)
    const transitioned = await transitionDeploySession({
      id: rec.id,
      fromStep: fromStep as any,
      toStep: toStep as any,
      lastUserOpHash: null,
      lastTxHash: null,
      lastError: null,
      payloadPatch: { [stageKey]: null },
    })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    const { bundler, paymasterClient, account } = await getCtx()
    try {
      const nextHash = await sendUserOperation(bundler, {
        account,
        calls: fullCalls,
        paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
      })
      await updateDeploySession({
        id: rec.id,
        step: toStep as any,
        lastUserOpHash: nextHash,
        lastTxHash: null,
        lastError: null,
        payloadPatch: { [stageKey]: nextHash },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'send_userop_failed')
      const debug = buildUserOpErrorDebug({
        err,
        sessionId: rec.id,
        stage: toStep,
        calls: fullCalls,
      })
      await updateDeploySession({
        id: rec.id,
        step: toStep as any,
        lastUserOpHash: null,
        lastTxHash: null,
        lastError: `${toStep}_send_failed:${msg}`,
        payloadPatch: { lastErrorDebug: debug },
      })
      throw err
    }
  }

  const startNextAfterPhase2 = async (fromStep: string) => {
    if (hasPhase3) {
      // Solana route/token registration is now treated as out-of-band strategy-stage prep.
      await ensureSolanaRouteReadyForPhase3({
        req,
        publicClient,
        phase2FinalizeCalls,
        solanaOvault: payload.solanaOvault,
      })
      await startStage(fromStep, 'phase3_sent', phase3Calls, !hasPhase4)
      return true
    }
    if (hasPhase4) {
      await startStage(fromStep, 'phase4_sent', phase4Calls, true)
      return true
    }
    return false
  }

  const getSentStagePlan = (
    sentStep: string,
  ): { calls: Array<{ to: Address; value: bigint; data: Hex }>; attachCleanup: boolean } | null => {
    if (sentStep === 'phase1_sent') {
      const phase1CoreCalls = phase1Calls.length > 1 ? phase1Calls.slice(0, 1) : phase1Calls
      return {
        calls: phase1CoreCalls,
        attachCleanup: phase1FinalizeCalls.length === 0 && phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      }
    }
    if (sentStep === 'phase1_finalize_sent') {
      return {
        calls: phase1FinalizeCalls,
        attachCleanup: phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      }
    }
    if (sentStep === 'phase2_core_sent') {
      return {
        calls: phase2CoreCalls,
        attachCleanup: !hasPhase2Finalize && !hasPostPhase2,
      }
    }
    if (sentStep === 'phase2_sent') {
      return {
        calls: phase2FinalizeCalls,
        attachCleanup: !hasPostPhase2,
      }
    }
    if (sentStep === 'phase3_sent') {
      return {
        calls: phase3Calls,
        attachCleanup: !hasPhase4,
      }
    }
    if (sentStep === 'phase4_sent') {
      return {
        calls: phase4Calls,
        attachCleanup: true,
      }
    }
    return null
  }

  const dispatchSentStage = async (sentStep: string): Promise<void> => {
    const plan = getSentStagePlan(sentStep)
    if (!plan) return
    const fullCalls = [...plan.calls]
    if (plan.attachCleanup && !persistSessionOwner) {
      fullCalls.push((await getCtx()).removeOwnerCall)
    }
    const permissionCheck = validateCallsAgainstGrant({
      grant: erc7712Grant,
      calls: fullCalls,
      expectedChainId: 8453,
      expectedSessionId: rec.id,
    })
    if (!permissionCheck.ok) throw new Error(permissionCheck.reason ?? 'erc7712_permission_denied')
    const { bundler, paymasterClient, account } = await getCtx()
    try {
      const nextHash = await sendUserOperation(bundler, {
        account,
        calls: fullCalls,
        paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
      })
      await updateDeploySession({
        id: rec.id,
        lastUserOpHash: nextHash,
        lastTxHash: null,
        lastError: null,
        payloadPatch: { [stageUserOpHashKey(sentStep)]: nextHash },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'send_userop_failed')
      const debug = buildUserOpErrorDebug({
        err,
        sessionId: rec.id,
        stage: sentStep,
        calls: fullCalls,
      })
      await updateDeploySession({
        id: rec.id,
        lastUserOpHash: null,
        lastTxHash: null,
        lastError: `${sentStep}_send_failed:${msg}`,
        payloadPatch: { lastErrorDebug: debug },
      })
      throw err
    }
  }

  const resolveReceiptTxHash = async (): Promise<Hex | undefined> => {
    if (!needsReceipt) return undefined
    const stageKey = stageUserOpHashKey(step)
    let stageHash = asHexHash(payload?.[stageKey])
    if (!stageHash) {
      const fallback = asHexHash(rec.lastUserOpHash)
      // Adopt legacy fallback only when tx hash is empty (means it wasn't reused from a prior stage).
      if (fallback && !asHexHash(rec.lastTxHash)) {
        stageHash = fallback
        await updateDeploySession({ id: rec.id, payloadPatch: { [stageKey]: stageHash } })
      }
    }
    if (!stageHash) {
      if (step !== 'cleanup_sent') {
        await dispatchSentStage(step)
      }
      return undefined
    }
    const receipt = await bundlerClient.getUserOperationReceipt({ hash: stageHash }).catch(() => null)
    return receipt?.receipt?.transactionHash as Hex | undefined
  }

  if (needsReceipt) {
    txHash = await resolveReceiptTxHash()
    if (!txHash) return
  }

  if (step === 'phase1_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_sent',
      toStep: 'phase1_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (phase1FinalizeCalls.length > 0) {
      await startStage(
        'phase1_confirmed',
        'phase1_finalize_sent',
        phase1FinalizeCalls,
        phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      )
      return
    }
    if (phase2CoreCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_core_sent', phase2CoreCalls, !hasPhase2Finalize && !hasPostPhase2)
      return
    }
    if (hasPhase2Finalize) {
      await startStage('phase1_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase1_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase1_finalize_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_sent',
      toStep: 'phase1_finalize_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (phase2CoreCalls.length > 0) {
      await startStage(
        'phase1_finalize_confirmed',
        'phase2_core_sent',
        phase2CoreCalls,
        !hasPhase2Finalize && !hasPostPhase2,
      )
      return
    }
    if (hasPhase2Finalize) {
      await startStage('phase1_finalize_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_finalize_confirmed')
      return
    }
    const completed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_confirmed',
      toStep: 'completed',
    })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_core_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase2_core_sent',
      toStep: 'phase2_core_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (hasPhase2Finalize) {
      await startStage('phase2_core_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_core_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_core_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase2_sent',
      toStep: 'phase2_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase3_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase3_sent',
      toStep: 'phase3_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    if (hasPhase4) {
      await startStage('phase3_confirmed', 'phase4_sent', phase4Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase3_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase4_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase4_sent',
      toStep: 'phase4_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase4_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  // Resume-safe advancement for sessions that already reached a confirmed state.
  if (step === 'phase1_confirmed') {
    if (phase1FinalizeCalls.length > 0) {
      await startStage(
        'phase1_confirmed',
        'phase1_finalize_sent',
        phase1FinalizeCalls,
        phase2CoreCalls.length === 0 && phase2FinalizeCalls.length === 0 && !hasPostPhase2,
      )
      return
    }
    if (phase2CoreCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_core_sent', phase2CoreCalls, phase2FinalizeCalls.length === 0 && !hasPostPhase2)
      return
    }
    if (phase2FinalizeCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase1_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase1_finalize_confirmed') {
    if (phase2CoreCalls.length > 0) {
      await startStage(
        'phase1_finalize_confirmed',
        'phase2_core_sent',
        phase2CoreCalls,
        phase2FinalizeCalls.length === 0 && !hasPostPhase2,
      )
      return
    }
    if (phase2FinalizeCalls.length > 0) {
      await startStage('phase1_finalize_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_finalize_confirmed')
      return
    }
    const completed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_confirmed',
      toStep: 'completed',
    })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_core_confirmed') {
    if (hasPhase2Finalize) {
      await startStage('phase2_core_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_core_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_core_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_confirmed') {
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase3_confirmed') {
    if (hasPhase4) {
      await startStage('phase3_confirmed', 'phase4_sent', phase4Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase3_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase4_confirmed') {
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase4_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<StatusRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  let rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  // Ensure the SIWE session matches the recorded sessionAddress.
  const sessionAddress = getAddress(auth.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    await advanceDeploySession(rec, req)
    rec = (await getDeploySessionById(sessionId)) ?? rec
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err ?? 'deploy_session_advance_failed')
    if (err instanceof Error && (err.message === 'deploy_payload_invalid' || err.message.endsWith('_calls_invalid'))) {
      return res.status(409).json({
        success: false,
        error: 'Deploy session payload is invalid or missing required stage calls. Please restart deploy session.',
      } satisfies ApiEnvelope<null>)
    }
    if (err instanceof Error && err.message === CONCURRENT_MODIFICATION) {
      return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
    }
    if (err instanceof Error && err.message === 'cdp_endpoint_missing_on_vercel') {
      return res.status(503).json({
        success: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint; do not rely on same-origin /api/paymaster for server-side deploy-session calls.',
      } satisfies ApiEnvelope<null>)
    }
    try {
      let serializedErr = ''
      try {
        serializedErr = JSON.stringify(err)
      } catch {
        serializedErr = ''
      }
      const advanceDebug = buildUserOpErrorDebug({
        err,
        sessionId: rec.id,
        stage: rec.step,
        calls: null,
      })
      const revertLike =
        isOnchainRevertLike(errMsg) ||
        isOnchainRevertLike(serializedErr) ||
        Boolean(advanceDebug.revertData || advanceDebug.selector)
      await updateDeploySession({
        id: rec.id,
        lastError: errMsg,
        ...(revertLike ? { payloadPatch: { lastErrorDebug: advanceDebug } } : {}),
      })
      rec = (await getDeploySessionById(sessionId)) ?? rec
    } catch {
      rec = {
        ...rec,
        lastError: errMsg,
      }
    }
    if (err instanceof Error && (err.message === 'session_owner_unavailable' || err.message === 'session_owner_key_missing')) {
      // Legacy/broken session: keep status readable without failing the endpoint.
      rec = {
        ...rec,
        lastError: rec.lastError || 'session_owner_unavailable',
      }
    }
    // Best-effort: if background advancement fails, still return current state.
  }

  return res.status(200).json({
    success: true,
    data: {
      id: rec.id,
      step: rec.step,
      expiresAt: rec.expiresAt,
      lastError: rec.lastError,
      lastUserOpHash: rec.lastUserOpHash,
      lastTxHash: rec.lastTxHash,
      smartWallet: rec.smartWallet,
      sessionSignerAddress: rec.sessionOwner,
      sessionSignerWalletId:
        (typeof rec?.payload?.deploySignerWalletId === 'string' && rec.payload.deploySignerWalletId.trim()) ||
        (typeof rec?.payload?.agentWalletId === 'string' && rec.payload.agentWalletId.trim()) ||
        null,
      sessionOwner: rec.sessionOwner,
    },
  } satisfies ApiEnvelope<any>)
}
