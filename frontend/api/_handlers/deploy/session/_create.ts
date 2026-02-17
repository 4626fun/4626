import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createPublicClient, encodeAbiParameters, encodeFunctionData, getAddress, http, isAddress, type Address, type Hex } from 'viem'
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
import { resolveCoinParties } from '../../../../server/_lib/coinParties.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

// JSON comes over the wire, so `value` may be a string/number.
type Call = { to: Address; value?: bigint | number | string; data: Hex }

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
  // Optional metadata for debugging/UI.
  version?: string
}

type CreateDeploySessionResponse = {
  sessionId: string
  sessionOwner: Address
  expiresAt: string
}

type OwnershipCheck = {
  ok: boolean
  reason?: string
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

/**
 * Check if an address is on the creator allowlist.
 * Checks: direct allowlist, CSW ownership, linked wallets, and approved profiles.
 */
async function checkCreatorAllowlist(address: Address, smartWallet: Address): Promise<boolean> {
  const addr = address.toLowerCase()
  const csw = smartWallet.toLowerCase()

  // Try Supabase first
  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    try {
      // Check direct allowlist entry
      const { data: allowlistData } = await supabase
        .from('allowlist')
        .select('id')
        .or(`address.ilike.${addr},csw_address.ilike.${csw}`)
        .is('revoked_at', null)
        .limit(1)
      if (allowlistData && allowlistData.length > 0) return true

      // Check creator_wallets table
      const { data: walletData } = await supabase
        .from('creator_wallets')
        .select('id')
        .or(`wallet_address.ilike.${addr},wallet_address.ilike.${csw}`)
        .limit(1)
      if (walletData && walletData.length > 0) return true

      // Check approved profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .or(`primary_wallet.ilike.${addr},embedded_wallet.ilike.${addr},csw_address.ilike.${csw}`)
        .eq('app_access_status', 'approved')
        .limit(1)
      if (profileData && profileData.length > 0) return true

      return false
    } catch {
      // Fall through to Postgres
    }
  }

  // Fallback to Postgres
  const db = await getDb()
  if (!db?.query) return false

  try {
    const result = await db.query(`
      SELECT 1 FROM allowlist WHERE (LOWER(address) = $1 OR LOWER(csw_address) = $2) AND revoked_at IS NULL
      UNION ALL
      SELECT 1 FROM creator_wallets WHERE LOWER(wallet_address) = $1 OR LOWER(wallet_address) = $2
      UNION ALL
      SELECT 1 FROM profiles WHERE (LOWER(primary_wallet) = $1 OR LOWER(embedded_wallet) = $1 OR LOWER(csw_address) = $2) AND app_access_status = 'approved'
      LIMIT 1;
    `, [addr, csw])
    return result.rows && result.rows.length > 0
  } catch {
    return false
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

async function validateCreatorCoinState(params: {
  creatorToken: Address
  smartWallet: Address
}): Promise<{ ok: boolean; reason?: string }> {
  const parties = await resolveCoinParties(params.creatorToken.toLowerCase() as `0x${string}`)
  if (!parties.creator && !parties.payoutRecipient) {
    return { ok: false, reason: 'creator_coin_not_found' }
  }
  const smartWalletLc = params.smartWallet.toLowerCase()
  const creatorLc = parties.creator?.toLowerCase() ?? null
  const payoutLc = parties.payoutRecipient?.toLowerCase() ?? null
  if (smartWalletLc !== creatorLc && smartWalletLc !== payoutLc) {
    return { ok: false, reason: 'creator_coin_wallet_mismatch' }
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
    const smartWallet = getAddress(body.smartWallet)
    const creatorToken = getAddress(body.creatorToken)
    const ownerAddress = getAddress(body.ownerAddress)

    if (!isAddress(smartWallet) || !isAddress(creatorToken) || !isAddress(ownerAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid addresses' } satisfies ApiEnvelope<null>)
    }

    const creatorCoinState = await validateCreatorCoinState({ creatorToken, smartWallet })
    if (!creatorCoinState.ok) {
      return res.status(403).json({
        success: false,
        error: creatorCoinState.reason
          ? `Creator coin requirement failed: ${creatorCoinState.reason}`
          : 'Creator coin requirement failed',
      } satisfies ApiEnvelope<null>)
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

    // Check creator allowlist before creating session
    const isAllowlisted = await checkCreatorAllowlist(sessionAddress, smartWallet)
    if (!isAllowlisted) {
      return res.status(403).json({ success: false, error: 'Creator access required. Please apply for access first.' } satisfies ApiEnvelope<null>)
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
    const phase2CoreCalls = Array.isArray(body.phase2CoreCalls) ? body.phase2CoreCalls : []
    const phase2FinalizeCalls = Array.isArray(body.phase2FinalizeCalls) ? body.phase2FinalizeCalls : []
    const phase2Calls = Array.isArray(body.phase2Calls) ? body.phase2Calls : []
    const phase3Calls = Array.isArray(body.phase3Calls) ? body.phase3Calls : []
    const phase4Calls = Array.isArray(body.phase4Calls) ? body.phase4Calls : []

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

    const deployToken = randomDeployToken()
    const tokenHash = hashDeployToken(deployToken)
    const id = randomId()

    // Preferred: per-creator Privy-managed agent wallet (Keepr can reuse it for ops).
    // Fallback: ephemeral local session owner key when Privy wallet provisioning is unavailable.
    let sessionOwnerPrivateKey: Hex | null = null
    let agentWalletId: string | null = null
    let agentWalletAddress: Address | null = null
    let sessionOwner: Address
    try {
      const agentWallet = await getOrCreateCreatorAgentWallet({ creatorToken: creatorToken.toLowerCase() as `0x${string}` })
      const walletId = String(agentWallet.walletId || '').trim()
      if (!walletId) throw new Error('agent_wallet_id_missing')
      sessionOwner = getAddress(agentWallet.address)
      agentWalletId = walletId
      agentWalletAddress = getAddress(agentWallet.address)
    } catch (e: any) {
      const fallback = privateKeyToAccount(generatePrivateKey())
      sessionOwnerPrivateKey = fallback.privateKey
      sessionOwner = getAddress(fallback.address)
      console.warn('deploy/session/create: falling back to ephemeral session owner key', {
        reason: e?.message ? String(e.message) : 'agent_wallet_create_failed',
      })
    }

    const now = Date.now()
    const expiresAt = new Date(now + 10 * 60 * 1000) // 10 minutes

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
      cleanupGrantCall,
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
        ...(agentWalletId ? { agentWalletId } : null),
        ...(agentWalletAddress ? { agentWalletAddress } : null),
        version: String(body.version ?? ''),
        phase1Calls,
        phase2CoreCalls,
        phase2FinalizeCalls,
        phase2Calls,
        phase3Calls,
        phase4Calls,
        erc7712Grant,
      },
      expiresAt,
    })

    const out: CreateDeploySessionResponse = { sessionId: id, sessionOwner, expiresAt: expiresAt.toISOString() }
    return res.status(200).json({ success: true, data: out } satisfies ApiEnvelope<CreateDeploySessionResponse>)
  } catch (e: any) {
    console.error('deploy/session/create error', e?.message ? String(e.message) : e)
    return res.status(500).json({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>)
  }
}
