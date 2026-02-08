import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, isAddress, type Address, type Hex } from 'viem'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { ensureDeploySessionsSchema, hashDeployToken, insertDeploySession, randomDeployToken, randomId } from '../../../../server/_lib/deploySessions.js'
import { isDbConfigured, getDb } from '../../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from '../../../../server/_lib/rateLimit.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'
import { getOrCreateCreatorAgentWallet } from '../../../../server/_lib/creatorAgentWallets.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type Call = { to: Address; value?: bigint; data: Hex }

type CreateDeploySessionRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  // Calls that the server will submit after the user signs the first UserOp.
  // These are executed by the Coinbase Smart Wallet via ERC-4337.
  phase2Calls: Call[]
  phase3Calls?: Call[]
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
  const db = await getDb()
  if (!db) return { ok: false, reason: 'ownership_db_unavailable' }
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
  const profileId = canonicalRow.rows?.[0]?.profile_id
  if (!profileId) return { ok: false, reason: 'canonical_wallet_not_verified' }

  const embeddedRow = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profileId}
      AND is_embedded_eoa = true
      AND verified_at IS NOT NULL
    LIMIT 1;
  `
  const embeddedAddress = typeof embeddedRow.rows?.[0]?.address === 'string' ? String(embeddedRow.rows[0].address).toLowerCase() : ''
  if (!embeddedAddress) return { ok: false, reason: 'embedded_wallet_not_verified' }

  const belongs = async (addr: string): Promise<boolean> => {
    if (addr === smartWalletLc || addr === embeddedAddress) return true
    const row = await db.sql`
      SELECT 1
      FROM profile_wallets
      WHERE profile_id = ${profileId}
        AND LOWER(address) = ${addr}
      LIMIT 1;
    `
    return Array.isArray(row.rows) && row.rows.length > 0
  }

  const ownerBelongs = await belongs(ownerLc)
  if (!ownerBelongs) return { ok: false, reason: 'owner_not_linked' }

  const sessionBelongs = await belongs(sessionLc)
  if (!sessionBelongs) return { ok: false, reason: 'session_not_linked' }

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

  const session = readSessionFromRequest(req)
  if (!session?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  // Rate limiting: 3 deploy sessions per minute per address
  const rateLimit = checkRateLimit(rateLimitKey('deploy', session.address.toLowerCase()), RATE_LIMITS.deployCreate)
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many deploy attempts. Please try again later.' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<CreateDeploySessionRequest>(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)

  try {
    const sessionAddress = getAddress(session.address as Address)
    const smartWallet = getAddress(body.smartWallet)
    const creatorToken = getAddress(body.creatorToken)
    const ownerAddress = getAddress(body.ownerAddress)

    if (!isAddress(smartWallet) || !isAddress(creatorToken) || !isAddress(ownerAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid addresses' } satisfies ApiEnvelope<null>)
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

    const phase2Calls = Array.isArray(body.phase2Calls) ? body.phase2Calls : []
    const phase3Calls = Array.isArray(body.phase3Calls) ? body.phase3Calls : []
    if (phase2Calls.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing phase2Calls' } satisfies ApiEnvelope<null>)
    }

    const deployToken = randomDeployToken()
    const tokenHash = hashDeployToken(deployToken)
    const id = randomId()

    // Use a per-creator Privy-managed agent wallet (Keepr can reuse it for ops).
    // We still install it as a temporary CSW owner only during deploy/ops windows.
    const agentWallet = await getOrCreateCreatorAgentWallet({ creatorToken: creatorToken.toLowerCase() as `0x${string}` })
    const sessionOwner = getAddress(agentWallet.address)

    const now = Date.now()
    const expiresAt = new Date(now + 10 * 60 * 1000) // 10 minutes

    await ensureDeploySessionsSchema()
    await insertDeploySession({
      id,
      tokenHash,
      sessionAddress: sessionAddress,
      smartWallet,
      sessionOwner,
      deployToken,
      payload: {
        creatorToken,
        ownerAddress,
        smartWallet,
        sessionOwner,
        agentWalletId: agentWallet.walletId,
        agentWalletAddress: agentWallet.address,
        version: String(body.version ?? ''),
        phase2Calls,
        phase3Calls,
      },
      expiresAt,
    })

    const out: CreateDeploySessionResponse = { sessionId: id, sessionOwner, expiresAt: expiresAt.toISOString() }
    return res.status(200).json({ success: true, data: out } satisfies ApiEnvelope<CreateDeploySessionResponse>)
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>)
  }
}
