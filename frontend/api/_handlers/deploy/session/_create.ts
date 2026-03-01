import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  createPublicClient,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { base } from 'viem/chains'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { ensureDeploySessionsSchema, hashDeployToken, insertDeploySession, randomDeployToken, randomId } from '../../../../server/_lib/deploySessions.js'
import { isDbConfigured, getDb } from '../../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from '../../../../server/_lib/rateLimit.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'
import { getOrCreateCreatorAgentWallet } from '../../../../server/_lib/creatorAgentWallets.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { buildDeployPermissionGrant } from '../../../../server/_lib/erc7712Permissions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { resolveCoinParties } from '../../../../server/_lib/coinParties.js'
import {
  normalizeSolanaAssetMintOrigin,
  parseSolanaOvaultMintCompatibilityHints,
} from '../../../../server/_lib/solanaOvaultCompatibility.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

// JSON comes over the wire, so `value` may be a string/number.
type Call = { to: Address; value?: bigint | number | string; data: Hex }

type SolanaOvaultRequest = {
  enabled?: boolean
  assetMintOrigin?: 'existing' | 'new'
  assetMeshMint?: string
  shareMeshMint?: string
  solanaEid?: number | string
  mintCompatibilityHints?: unknown
}

type CreateDeploySessionRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  // Optional preflight mode:
  // validate auth + ownership + allowlist without creating a deploy session.
  preflightOnly?: boolean
  // Calls that the server will submit after the user approves a one-time setup
  // transaction that installs `sessionOwner` as a temporary onchain CSW owner.
  // These calls are executed by the Coinbase Smart Wallet via ERC-4337.
  // New (preferred): split Phase 2 into multiple UserOps server-side.
  phase1Calls?: Call[]
  phase2CoreCalls?: Call[]
  phase2FinalizeCalls?: Call[]
  // Back-compat: older clients submit a single Phase 2 array.
  phase2Calls?: Call[]
  // Phase 3 (strategies) + Phase 4 (deferred auction) are also executed server-side.
  phase3Calls?: Call[]
  phase4Calls?: Call[]
  solanaOvault?: SolanaOvaultRequest
  // Optional metadata for debugging/UI.
  version?: string
}

type CreateDeploySessionResponse = {
  sessionId: string
  // Canonical field name for the signer identity used by server-side continuation.
  // `sessionOwner` is kept for backward compatibility with existing clients.
  sessionSignerAddress: Address
  sessionSignerWalletId?: string
  sessionOwner: Address
  expiresAt: string
}

type OwnershipCheck = {
  ok: boolean
  reason?: string
}

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
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

const CREATOR_VAULT_BATCHER_PENDING_AUCTION_ABI = [
  {
    type: 'function',
    name: 'pendingAuctions',
    stateMutability: 'view',
    inputs: [{ name: 'salt', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'shareToken', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  },
] as const

function deriveBaseSalt(params: { creatorToken: Address; owner: Address; chainId: number; version: string }): Hex {
  return keccak256(
    encodePacked(['address', 'address', 'uint256', 'string'], [
      params.creatorToken,
      params.owner,
      BigInt(params.chainId),
      `4626:deploy:${params.version}`,
    ]),
  ) as Hex
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
  // Keep Privy-managed session owners installed by default to reduce repeated add-owner prompts.
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, true)
}

const DEFAULT_DEPLOY_SESSION_TTL_MINUTES = 45
const MIN_DEPLOY_SESSION_TTL_MINUTES = 5
const MAX_DEPLOY_SESSION_TTL_MINUTES = 240

function readDeploySessionTtlMinutes(): number {
  const raw = String(process.env.DEPLOY_SESSION_TTL_MINUTES ?? '').trim()
  if (!raw) return DEFAULT_DEPLOY_SESSION_TTL_MINUTES
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEPLOY_SESSION_TTL_MINUTES
  const wholeMinutes = Math.floor(parsed)
  return Math.min(MAX_DEPLOY_SESSION_TTL_MINUTES, Math.max(MIN_DEPLOY_SESSION_TTL_MINUTES, wholeMinutes))
}

function readDeploySessionTtlMs(): number {
  return readDeploySessionTtlMinutes() * 60 * 1000
}

function parseUInt32Like(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 4_294_967_295) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 4_294_967_295) {
      return Math.floor(parsed)
    }
  }
  return null
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

function extractFinalizePhase2ApprovalInfo(data: Hex): {
  creatorToken: Address
  depositAmount: bigint
} | null {
  for (const abi of [CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI, CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        depositAmount?: bigint | string | number
      } | null
      const creatorTokenCandidate =
        params?.creatorToken && isAddress(params.creatorToken)
          ? getAddress(params.creatorToken as Address)
          : null
      const creatorToken =
        creatorTokenCandidate && creatorTokenCandidate.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
          ? creatorTokenCandidate
          : null
      const depositAmount = parseBigIntLike(params?.depositAmount)
      if (!creatorToken || !depositAmount || depositAmount <= 0n) continue
      return { creatorToken, depositAmount }
    } catch {
      continue
    }
  }
  return null
}

function callFingerprint(call: Call | null | undefined): string | null {
  if (!call) return null
  const to = typeof call.to === 'string' && isAddress(call.to) ? getAddress(call.to as Address).toLowerCase() : ''
  const data = typeof call.data === 'string' ? call.data.trim().toLowerCase() : ''
  if (!to || !data.startsWith('0x')) return null
  return `${to}|${data}`
}

function derivePhase2FinalizeApprovalCalls(calls: Call[]): Call[] {
  if (!Array.isArray(calls) || calls.length === 0) return []
  const approvals: Call[] = []
  const seen = new Set<string>()
  for (const call of calls) {
    const to = typeof call?.to === 'string' && isAddress(call.to) ? getAddress(call.to as Address) : null
    const data = typeof call?.data === 'string' ? call.data.trim() : ''
    if (!to || !data.startsWith('0x')) continue
    const approvalInfo = extractFinalizePhase2ApprovalInfo(data as Hex)
    if (!approvalInfo) continue
    const approveData = encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [to, approvalInfo.depositAmount],
    }) as Hex
    const approveCall: Call = {
      to: approvalInfo.creatorToken,
      // Keep payload JSON-safe when persisted to DB.
      value: '0',
      data: approveData,
    }
    const key = callFingerprint(approveCall)
    if (!key || seen.has(key)) continue
    seen.add(key)
    approvals.push(approveCall)
  }
  return approvals
}

function appendUniqueCalls(base: Call[], extras: Call[]): Call[] {
  const out: Call[] = [...base]
  const seen = new Set<string>()
  for (const existing of out) {
    const key = callFingerprint(existing)
    if (key) seen.add(key)
  }
  for (const extra of extras) {
    const key = callFingerprint(extra)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(extra)
  }
  return out
}

function prependPhase2FinalizeApprovals(calls: Call[]): Call[] {
  if (!Array.isArray(calls) || calls.length === 0) return []
  const approvals = derivePhase2FinalizeApprovalCalls(calls)
  return appendUniqueCalls(approvals, calls)
}

function distributePhase2FinalizeApprovals(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
}): { phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[] } {
  const phase2CoreCalls = Array.isArray(params.phase2CoreCalls) ? [...params.phase2CoreCalls] : []
  const phase2FinalizeCalls = Array.isArray(params.phase2FinalizeCalls) ? [...params.phase2FinalizeCalls] : []
  const approvals = derivePhase2FinalizeApprovalCalls(phase2FinalizeCalls)
  if (approvals.length === 0) {
    return { phase2CoreCalls, phase2FinalizeCalls }
  }
  if (phase2CoreCalls.length > 0) {
    // Keep phase2 finalize focused on batcher finalize calls. Approval executes in phase2 core,
    // so allowance is already persisted before finalize is submitted.
    return {
      phase2CoreCalls: appendUniqueCalls(phase2CoreCalls, approvals),
      phase2FinalizeCalls,
    }
  }
  return {
    phase2CoreCalls,
    phase2FinalizeCalls: prependPhase2FinalizeApprovals(phase2FinalizeCalls),
  }
}

function normalizeSolanaOvaultConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>

  const enabled = raw.enabled === true
  const assetMintOrigin = normalizeSolanaAssetMintOrigin(raw.assetMintOrigin, 'existing')
  const assetMeshMint =
    typeof raw.assetMeshMint === 'string' && raw.assetMeshMint.trim()
      ? raw.assetMeshMint.trim()
      : null
  const shareMeshMint =
    typeof raw.shareMeshMint === 'string' && raw.shareMeshMint.trim()
      ? raw.shareMeshMint.trim()
      : null
  const solanaEid = parseUInt32Like(raw.solanaEid)
  const mintCompatibilityHints = parseSolanaOvaultMintCompatibilityHints(raw.mintCompatibilityHints)
  const hasMintHints = Object.values(mintCompatibilityHints).some((v) => v !== null)

  return {
    enabled,
    assetMintOrigin,
    ...(assetMeshMint ? { assetMeshMint } : null),
    ...(shareMeshMint ? { shareMeshMint } : null),
    ...(solanaEid !== null ? { solanaEid } : null),
    ...(hasMintHints ? { mintCompatibilityHints } : null),
  }
}


function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase().endsWith('.vercel.app')
  } catch {
    return true
  }
}

function getDirectCdpEndpoint(): string {
  return (
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  )
}

async function checkDeployInfraReady(origin: string): Promise<{ ok: boolean; error?: string }> {
  const endpoint = getDirectCdpEndpoint()
  const isVercelEnv = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)

  if (!endpoint) {
    if (isVercelEnv && isVercelDeploymentOrigin(origin)) {
      return {
        ok: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint.',
      }
    }
    return { ok: true }
  }

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8_000)
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_supportedEntryPoints', params: [] }),
      signal: ctrl.signal,
    })
    clearTimeout(t)

    const text = await upstream.text()
    const textLower = text.toLowerCase()
    if (textLower.includes('vercel authentication') || textLower.includes('x-vercel-protection-bypass') || textLower.includes('authentication required')) {
      return {
        ok: false,
        error:
          'Configured CDP_PAYMASTER_URL is Vercel-protected. Use the Coinbase RPC endpoint directly (https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY_ID>).',
      }
    }

    let rpcErr: string | null = null
    try {
      const j = JSON.parse(text)
      if (j && typeof j === 'object' && !Array.isArray(j) && (j as any)?.error?.message) {
        rpcErr = String((j as any).error.message)
      }
    } catch {
      // ignore parse errors
    }

    if (!upstream.ok) {
      return { ok: false, error: rpcErr || `CDP endpoint probe failed (HTTP ${upstream.status})` }
    }

    if (rpcErr) {
      return { ok: false, error: `CDP endpoint probe failed: ${rpcErr}` }
    }

    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'CDP endpoint probe failed'
    return { ok: false, error: `CDP endpoint probe failed: ${msg}` }
  }
}

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

async function isOnchainSmartWalletOwner(params: { smartWallet: Address; ownerAddress: Address }): Promise<boolean> {
  try {
    const rpcRaw = (process.env.BASE_RPC_URL ?? '').trim()
    const rpc = rpcRaw || 'https://mainnet.base.org'
    const publicClient = createPublicClient({
      chain: base,
      transport: http(rpc, { timeout: 12_000 }),
    })
    const result = (await publicClient.readContract({
      address: params.smartWallet,
      abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
      functionName: 'isOwnerAddress',
      args: [params.ownerAddress],
    })) as boolean
    return result === true
  } catch {
    return false
  }
}

type CreatorAllowlistMatch = 'allowlist' | 'creator_wallets' | 'profiles_approved' | 'none'

type CreatorAllowlistCheck = {
  allowed: boolean
  matchedBy: CreatorAllowlistMatch
  checkedAddresses: string[]
}

function normalizeAllowlistAddresses(input: Array<Address | string | null | undefined>): Address[] {
  const out = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'string') continue
    if (!isAddress(raw)) continue
    out.add(getAddress(raw).toLowerCase())
  }
  return Array.from(out).map((v) => getAddress(v as Address))
}

function buildSupabaseOrFilters(fields: string[], addresses: string[]): string {
  return addresses.flatMap((addr) => fields.map((field) => `${field}.ilike.${addr}`)).join(',')
}

async function resolveAllowlistAddresses(params: {
  sessionAddress: Address
  smartWallet: Address
  creatorToken: Address
}): Promise<Address[]> {
  const base = normalizeAllowlistAddresses([params.sessionAddress, params.smartWallet])
  try {
    const parties = await resolveCoinParties(params.creatorToken as `0x${string}`)
    const combined = normalizeAllowlistAddresses([
      params.sessionAddress,
      params.smartWallet,
      parties.creator,
      parties.payoutRecipient,
    ])
    return combined.length > 0 ? combined : base
  } catch {
    return base
  }
}

/**
 * Check if the deploy actor is allowed to create a deploy session.
 *
 * Keep this aligned with `/api/creator-allowlist` so UI gate + deploy-session gate
 * evaluate the same address set:
 * - authenticated session wallet
 * - canonical smart wallet sender
 * - creator/payoutRecipient resolved from creatorToken
 */
async function checkCreatorAllowlist(params: {
  sessionAddress: Address
  smartWallet: Address
  creatorToken: Address
}): Promise<CreatorAllowlistCheck> {
  const addressesToCheck = await resolveAllowlistAddresses(params)
  const addressFilters = addressesToCheck.map((a) => a.toLowerCase())

  if (addressFilters.length === 0) {
    return { allowed: false, matchedBy: 'none', checkedAddresses: [] }
  }

  // Try Supabase first
  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    try {
      const allowlistRes = await supabase
        .from('allowlist')
        .select('id')
        .or(buildSupabaseOrFilters(['address', 'csw_address'], addressFilters))
        .is('revoked_at', null)
        .limit(1)
      if (!allowlistRes.error && Array.isArray(allowlistRes.data) && allowlistRes.data.length > 0) {
        return { allowed: true, matchedBy: 'allowlist', checkedAddresses: addressFilters }
      }

      const walletRes = await supabase
        .from('creator_wallets')
        .select('id')
        .or(buildSupabaseOrFilters(['wallet_address'], addressFilters))
        .limit(1)
      if (!walletRes.error && Array.isArray(walletRes.data) && walletRes.data.length > 0) {
        return { allowed: true, matchedBy: 'creator_wallets', checkedAddresses: addressFilters }
      }

      const profileRes = await supabase
        .from('profiles')
        .select('id')
        .or(buildSupabaseOrFilters(['primary_wallet', 'embedded_wallet', 'csw_address'], addressFilters))
        .eq('app_access_status', 'approved')
        .limit(1)
      if (!profileRes.error && Array.isArray(profileRes.data) && profileRes.data.length > 0) {
        return { allowed: true, matchedBy: 'profiles_approved', checkedAddresses: addressFilters }
      }

      return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }
    } catch {
      // Fall through to Postgres
    }
  }

  // Fallback to Postgres
  const db = await getDb()
  if (!db?.query) return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }

  try {
    const allowlisted = await db.query(
      `SELECT 1
       FROM allowlist
       WHERE (LOWER(address) = ANY($1) OR LOWER(csw_address) = ANY($1))
         AND revoked_at IS NULL
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(allowlisted.rows) && allowlisted.rows.length > 0) {
      return { allowed: true, matchedBy: 'allowlist', checkedAddresses: addressFilters }
    }

    const linked = await db.query(
      `SELECT 1
       FROM creator_wallets
       WHERE LOWER(wallet_address) = ANY($1)
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(linked.rows) && linked.rows.length > 0) {
      return { allowed: true, matchedBy: 'creator_wallets', checkedAddresses: addressFilters }
    }

    const approved = await db.query(
      `SELECT 1
       FROM profiles
       WHERE (LOWER(primary_wallet) = ANY($1)
         OR LOWER(embedded_wallet) = ANY($1)
         OR LOWER(csw_address) = ANY($1))
         AND COALESCE(app_access_status, 'pending') = 'approved'
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(approved.rows) && approved.rows.length > 0) {
      return { allowed: true, matchedBy: 'profiles_approved', checkedAddresses: addressFilters }
    }

    return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }
  } catch {
    return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }
  }
}

async function checkCanonicalWalletOwnership(params: {
  smartWallet: Address
  ownerAddress: Address
  sessionAddress: Address
}): Promise<OwnershipCheck> {
  const onchainOwnerCheck = async (): Promise<OwnershipCheck> => {
    // In deploy payloads, ownerAddress/sessionAddress can legitimately be the
    // canonical smart wallet itself. Treat that as valid ownership context.
    if (params.ownerAddress.toLowerCase() === params.smartWallet.toLowerCase()) {
      // If session is the CSW itself, it's valid immediately.
      if (params.sessionAddress.toLowerCase() === params.smartWallet.toLowerCase()) return { ok: true }
      // Otherwise the active session wallet must be an onchain owner of the CSW.
      const sessionIsOnchain = await isOnchainSmartWalletOwner({
        smartWallet: params.smartWallet,
        ownerAddress: params.sessionAddress,
      })
      if (sessionIsOnchain) return { ok: true }
      return { ok: false, reason: 'session_not_onchain_owner' }
    }

    const ownerIsOnchain = await isOnchainSmartWalletOwner({
      smartWallet: params.smartWallet,
      ownerAddress: params.ownerAddress,
    })
    if (!ownerIsOnchain) return { ok: false, reason: 'owner_not_onchain_owner' }

    // Session signer can be the same owner wallet, or another linked owner.
    if (params.sessionAddress.toLowerCase() === params.ownerAddress.toLowerCase()) return { ok: true }
    const sessionIsOnchain = await isOnchainSmartWalletOwner({
      smartWallet: params.smartWallet,
      ownerAddress: params.sessionAddress,
    })
    if (!sessionIsOnchain) return { ok: false, reason: 'session_not_onchain_owner' }
    return { ok: true }
  }

  const db = await getDb()
  if (!db) return await onchainOwnerCheck()
  await ensureWaitlistSchema(db as any)

  const smartWalletLc = params.smartWallet.toLowerCase()
  const ownerLc = params.ownerAddress.toLowerCase()
  const sessionLc = params.sessionAddress.toLowerCase()

  const canonicalRow = await db.sql`
    SELECT profile_id
    FROM profile_wallets
    WHERE LOWER(address) = ${smartWalletLc}
      AND is_canonical_smart_wallet = true
    LIMIT 1;
  `
  let profileId = canonicalRow.rows?.[0]?.profile_id ?? null
  if (!profileId) {
    // Fallback for legacy rows that have canonical wallet fields populated
    // but have not yet been fully synced into `profile_wallets`.
    const legacyCanonicalRow = await db.sql`
      SELECT id
      FROM profiles
      WHERE LOWER(primary_smart_wallet) = ${smartWalletLc}
         OR LOWER(csw_address) = ${smartWalletLc}
         OR LOWER(base_sub_account) = ${smartWalletLc}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1;
    `
    profileId = legacyCanonicalRow.rows?.[0]?.id ?? null
  }
  if (!profileId) {
    const onchain = await onchainOwnerCheck()
    return onchain.ok ? onchain : { ok: false, reason: onchain.reason ?? 'canonical_wallet_not_verified' }
  }

  const linked = new Set<string>([smartWalletLc])
  const linkedRows = await db.sql`
    SELECT LOWER(address) AS address
    FROM profile_wallets
    WHERE profile_id = ${profileId}
      AND address IS NOT NULL;
  `
  for (const row of linkedRows.rows ?? []) {
    const addr = typeof row?.address === 'string' ? String(row.address).trim().toLowerCase() : ''
    if (addr) linked.add(addr)
  }

  const legacyProfileRow = await db.sql`
    SELECT
      LOWER(primary_wallet) AS primary_wallet,
      LOWER(embedded_wallet) AS embedded_wallet,
      LOWER(primary_embedded_eoa) AS primary_embedded_eoa,
      LOWER(primary_smart_wallet) AS primary_smart_wallet,
      LOWER(csw_address) AS csw_address,
      LOWER(base_sub_account) AS base_sub_account
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const legacyProfile = (legacyProfileRow.rows?.[0] ?? null) as Record<string, unknown> | null
  if (legacyProfile) {
    for (const value of Object.values(legacyProfile)) {
      const addr = typeof value === 'string' ? value.trim().toLowerCase() : ''
      if (addr) linked.add(addr)
    }
  }

  const belongs = async (addr: string): Promise<boolean> => {
    return linked.has(addr)
  }

  const ownerBelongs = await belongs(ownerLc)
  if (!ownerBelongs) {
    const onchain = await onchainOwnerCheck()
    return onchain.ok ? onchain : { ok: false, reason: onchain.reason ?? 'owner_not_linked' }
  }

  const sessionBelongs = await belongs(sessionLc)
  if (!sessionBelongs) {
    const onchain = await onchainOwnerCheck()
    return onchain.ok ? onchain : { ok: false, reason: onchain.reason ?? 'session_not_linked' }
  }

  return { ok: true }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Deploy sessions require DB configuration' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<CreateDeploySessionRequest>(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  const preflightOnly = body.preflightOnly === true

  // Rate limiting: 3 deploy sessions per minute per address
  // Preflight checks are read-only and should not consume create quota.
  if (!preflightOnly) {
    const rateLimit = checkRateLimit(rateLimitKey('deploy', auth.address.toLowerCase()), RATE_LIMITS.deployCreate)
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
      return res.status(429).json({ success: false, error: 'Too many deploy attempts. Please try again later.' } satisfies ApiEnvelope<null>)
    }
  }

  try {
    const sessionAddress = getAddress(auth.address as Address)
    const smartWalletRaw = typeof body.smartWallet === 'string' ? body.smartWallet.trim() : ''
    const creatorTokenRaw = typeof body.creatorToken === 'string' ? body.creatorToken.trim() : ''
    const ownerAddressRaw = typeof body.ownerAddress === 'string' ? body.ownerAddress.trim() : ''

    if (!isAddress(smartWalletRaw) || !isAddress(creatorTokenRaw) || !isAddress(ownerAddressRaw)) {
      return res.status(400).json({ success: false, error: 'Invalid addresses' } satisfies ApiEnvelope<null>)
    }
    const smartWallet = getAddress(smartWalletRaw as Address)
    const creatorToken = getAddress(creatorTokenRaw as Address)
    const ownerAddress = getAddress(ownerAddressRaw as Address)
    if (ownerAddress.toLowerCase() !== smartWallet.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'ownerAddress must match smartWallet (canonical deploy sender)',
      } satisfies ApiEnvelope<null>)
    }

    const origin = getCanonicalOrigin(req)
    const infra = await checkDeployInfraReady(origin)
    if (!infra.ok) {
      return res.status(503).json({ success: false, error: infra.error || 'Deploy infrastructure unavailable' } satisfies ApiEnvelope<null>)
    }

    // Ownership is validated below against canonical profile linkage.
    // Do not hard-require sessionAddress===owner/smartWallet here because
    // embedded EOAs and other linked wallets are valid operators.
    const ownership = await checkCanonicalWalletOwnership({
      smartWallet,
      ownerAddress,
      sessionAddress,
    })
    if (!ownership.ok) {
      return res.status(403).json({
        success: false,
        error: ownership.reason ? `Deploy ownership mismatch: ${ownership.reason}` : 'Deploy ownership mismatch',
      } satisfies ApiEnvelope<null>)
    }

    // Check creator access before creating session.
    const allowlistCheck = await checkCreatorAllowlist({
      sessionAddress,
      smartWallet,
      creatorToken,
    })
    if (!allowlistCheck.allowed) {
      console.warn('[deploy/session/create] creator_access_denied', {
        sessionAddress: sessionAddress.toLowerCase(),
        smartWallet: smartWallet.toLowerCase(),
        creatorToken: creatorToken.toLowerCase(),
        checkedAddresses: allowlistCheck.checkedAddresses,
      })
      const checked = allowlistCheck.checkedAddresses.length > 0 ? allowlistCheck.checkedAddresses.join(', ') : 'none'
      return res.status(403).json({
        success: false,
        error:
          `Creator access required. Active session wallet ${sessionAddress} is not approved for this deploy. ` +
          `Checked addresses: ${checked}. Sign out/in with your approved wallet, or ask admin to approve your session wallet/canonical smart wallet.`,
      } satisfies ApiEnvelope<null>)
    }

    if (preflightOnly) {
      return res.status(200).json({
        success: true,
        data: {
          ready: true,
          authAddress: sessionAddress,
          smartWallet,
          ownerAddress,
          authType: auth.type,
        },
      } satisfies ApiEnvelope<{
        ready: boolean
        authAddress: Address
        smartWallet: Address
        ownerAddress: Address
        authType: 'session' | 'siwa'
      }>)
    }

    const phase1Calls = Array.isArray(body.phase1Calls) ? body.phase1Calls : []
    const phase2CoreCallsRaw = Array.isArray(body.phase2CoreCalls) ? body.phase2CoreCalls : []
    const phase2FinalizeCallsRaw = Array.isArray(body.phase2FinalizeCalls) ? body.phase2FinalizeCalls : []
    const phase2CallsRaw = Array.isArray(body.phase2Calls) ? body.phase2Calls : []
    const { phase2CoreCalls, phase2FinalizeCalls } = distributePhase2FinalizeApprovals({
      phase2CoreCalls: phase2CoreCallsRaw,
      phase2FinalizeCalls: phase2FinalizeCallsRaw,
    })
    const phase2Calls = prependPhase2FinalizeApprovals(phase2CallsRaw)
    const phase3Calls = Array.isArray(body.phase3Calls) ? body.phase3Calls : []
    const phase4Calls = Array.isArray(body.phase4Calls) ? body.phase4Calls : []
    const solanaOvault = normalizeSolanaOvaultConfig(body.solanaOvault)
    const hasPhase2Finalize = phase2FinalizeCalls.length > 0 || phase2Calls.length > 0

    const hasAnyWork =
      phase1Calls.length > 0 ||
      phase2CoreCalls.length > 0 ||
      phase2FinalizeCalls.length > 0 ||
      phase2Calls.length > 0 ||
      phase3Calls.length > 0 ||
      phase4Calls.length > 0
    if (!hasAnyWork) {
      return res.status(400).json({ success: false, error: 'Missing deploy calls' } satisfies ApiEnvelope<null>)
    }
    if (phase2CoreCalls.length > 0 && !hasPhase2Finalize) {
      return res.status(400).json({
        success: false,
        error: 'Missing phase2 finalize calls',
      } satisfies ApiEnvelope<null>)
    }

    // Phase-4 safety: when launching deferred auction without a same-session phase2 finalize,
    // require pending state to already exist for this deployment namespace.
    const hasSameSessionPhase2Finalize = phase2FinalizeCalls.length > 0 || phase2Calls.length > 0
    if (phase4Calls.length > 0 && !hasSameSessionPhase2Finalize) {
      const version = String(body.version ?? '').trim()
      if (!version) {
        return res.status(400).json({
          success: false,
          error: 'version is required when phase4Calls are present',
        } satisfies ApiEnvelope<null>)
      }
      const batcherAddress = getAddress(phase4Calls[0]!.to)
      const baseSalt = deriveBaseSalt({ creatorToken, owner: ownerAddress, chainId: 8453, version })
      const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
      const readClient = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 12_000 }),
      })
      try {
        const pending = (await readClient.readContract({
          address: batcherAddress,
          abi: CREATOR_VAULT_BATCHER_PENDING_AUCTION_ABI,
          functionName: 'pendingAuctions',
          args: [baseSalt],
        })) as unknown
        const pendingAny = pending as any
        const pendingAmount = BigInt(pendingAny?.amount ?? pendingAny?.[2] ?? 0n)
        if (pendingAmount <= 0n) {
          return res.status(409).json({
            success: false,
            error: `phase4 precheck failed: no pending deferred auction for deployment version ${version}`,
          } satisfies ApiEnvelope<null>)
        }
      } catch {
        return res.status(409).json({
          success: false,
          error: `phase4 precheck failed: could not validate pending deferred auction for deployment version ${version}`,
        } satisfies ApiEnvelope<null>)
      }
    }

    const deployToken = randomDeployToken()
    const tokenHash = hashDeployToken(deployToken)
    const id = randomId()

    // Preferred: per-creator Privy-managed deploy signer wallet (Keepr can reuse it for ops).
    // Fallback: ephemeral local session owner key when Privy wallet provisioning is unavailable.
    let sessionOwnerPrivateKey: Hex | null = null
    let deploySignerWalletId: string | null = null
    let deploySignerAddress: Address | null = null
    let sessionOwner: Address
    try {
      const agentWallet = await getOrCreateCreatorAgentWallet({ creatorToken: creatorToken.toLowerCase() as `0x${string}` })
      const walletId = String(agentWallet.walletId || '').trim()
      if (!walletId) throw new Error('agent_wallet_id_missing')
      sessionOwner = getAddress(agentWallet.address)
      deploySignerWalletId = walletId
      deploySignerAddress = getAddress(agentWallet.address)
    } catch (e: any) {
      const fallback = privateKeyToAccount(generatePrivateKey())
      sessionOwnerPrivateKey = (fallback as any).privateKey as Hex
      sessionOwner = getAddress(fallback.address)
      console.warn('deploy/session/create: falling back to ephemeral session owner key', {
        reason: e?.message ? String(e.message) : 'agent_wallet_create_failed',
      })
    }

    const now = Date.now()
    const expiresAt = new Date(now + readDeploySessionTtlMs())
    const persistSessionOwner = Boolean(deploySignerWalletId) && shouldPersistManagedSessionOwner()

    const cleanupGrantCall = {
      to: smartWallet,
      value: 0n,
      data: encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [0n, asOwnerBytes(sessionOwner)],
      }),
    }

    const allCallsForGrant = [
      ...phase1Calls,
      ...phase2CoreCalls,
      ...phase2FinalizeCalls,
      ...phase2Calls,
      ...phase3Calls,
      ...phase4Calls,
      ...(persistSessionOwner ? [] : [cleanupGrantCall]),
    ]
      .map((c) => ({ to: getAddress(c.to), value: typeof c.value === 'bigint' ? c.value : BigInt(c.value ?? 0), data: c.data as Hex }))
      .filter((c) => typeof c.data === 'string' && c.data.startsWith('0x'))

    const erc7712Grant = buildDeployPermissionGrant({
      sessionId: id,
      chainId: 8453,
      validAfter: new Date(now),
      validUntil: expiresAt,
      calls: allCallsForGrant,
    })

    await ensureDeploySessionsSchema()
    await insertDeploySession({
      id,
      tokenHash,
      sessionAddress: sessionAddress,
      smartWallet,
      sessionOwner,
      deployToken,
      sessionOwnerPrivateKey,
      payload: {
        creatorToken,
        ownerAddress,
        smartWallet,
        sessionOwner,
        authType: auth.type,
        ...(auth.type === 'siwa'
          ? {
              authAgentId: auth.agentId,
              authAgentRegistry: auth.agentRegistry,
              authAgentChainId: auth.chainId,
            }
          : null),
        // New names
        ...(deploySignerWalletId ? { deploySignerWalletId } : null),
        ...(deploySignerAddress ? { deploySignerAddress } : null),
        // Legacy aliases (kept for backward compatibility)
        ...(deploySignerWalletId ? { agentWalletId: deploySignerWalletId } : null),
        ...(deploySignerAddress ? { agentWalletAddress: deploySignerAddress } : null),
        persistSessionOwner,
        expectedStages: {
          hasPhase1Core: phase1Calls.length > 0,
          hasPhase1Finalize: phase1Calls.length > 1,
          hasPhase2Core: phase2CoreCalls.length > 0,
          hasPhase2Finalize,
          hasPhase3: phase3Calls.length > 0,
          hasPhase4: phase4Calls.length > 0,
        },
        version: String(body.version ?? ''),
        phase1Calls,
        phase2CoreCalls,
        phase2FinalizeCalls,
        phase2Calls,
        phase3Calls,
        phase4Calls,
        ...(solanaOvault ? { solanaOvault } : null),
        erc7712Grant,
      },
      expiresAt,
    })

    const out: CreateDeploySessionResponse = {
      sessionId: id,
      sessionSignerAddress: sessionOwner,
      ...(deploySignerWalletId ? { sessionSignerWalletId: deploySignerWalletId } : null),
      sessionOwner,
      expiresAt: expiresAt.toISOString(),
    }
    return res.status(200).json({ success: true, data: out } satisfies ApiEnvelope<CreateDeploySessionResponse>)
  } catch (e: any) {
    console.error('deploy/session/create error', e?.message ? String(e.message) : e)
    return res.status(500).json({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>)
  }
}
