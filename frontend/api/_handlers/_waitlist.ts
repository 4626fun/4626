import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import { normalizeReferralCode, getClientIp, getUserAgent, hashForAttribution } from '../../server/_lib/referrals.js'
import { checkRateLimit, RATE_LIMITS, rateLimitKey, getClientIp as getRateLimitIp } from '../../server/_lib/rateLimit.js'
import { awardWaitlistPoints, ensureWaitlistPointsSchema, WAITLIST_POINTS } from '../../server/_lib/waitlistPoints.js'
import { ensureWaitlistSchema } from '../../server/_lib/waitlistSchema.js'
import { readRequestPrincipalAddress } from '../../server/_lib/requestPrincipal.js'
import { preprovisionWaitlistUser } from '../../server/_lib/waitlistPreprovision.js'

declare const process: { env: Record<string, string | undefined> }

type WaitlistRequestBody = {
  email?: string
  primaryWallet?: string | null
  solanaWallet?: string | null
  baseSubAccount?: string | null
  cswAddress?: string | null  // Coinbase Smart Wallet address (linked before signup)
  referralCode?: string | null
  claimReferralCode?: string | null
  contactPreference?: string | null
  verifications?: Array<{ method?: string; subject?: string; timestamp?: string }> | null
  intent?: {
    persona?: 'creator' | 'user' | null
    hasCreatorCoin?: boolean | null
    fid?: number | null
  } | null
}

type WaitlistResponse = {
  created: boolean
  email: string
  referralCode?: string | null
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun') || v.endsWith('@wallet.4626.fun')
}

function isLegacySyntheticEmail(v: string): boolean {
  const s = String(v || '').trim().toLowerCase()
  if (!s.endsWith('@example.com')) return false
  const local = s.split('@')[0] ?? ''
  return (
    local.startsWith('solinfer-') ||
    local.startsWith('wallet-') ||
    local.startsWith('anon-') ||
    local.startsWith('0x')
  )
}

function isAnySyntheticEmail(v: string): boolean {
  return isSyntheticEmail(v) || isLegacySyntheticEmail(v)
}

function shouldAdoptIncomingEmail(existingEmail: string, incomingEmail: string): boolean {
  const existing = normalizeEmail(existingEmail)
  const incoming = normalizeEmail(incomingEmail)
  if (!existing || !incoming || existing === incoming) return false
  const incomingSynthetic = isAnySyntheticEmail(incoming)
  if (!incomingSynthetic) return true
  // Never overwrite a real email with a synthetic fallback email.
  return isAnySyntheticEmail(existing)
}

function normalizeAddress(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function isValidSolanaAddress(v: string): boolean {
  const s = String(v || '').trim()
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

type ContactPreference = 'wallet' | 'farcaster' | 'email' | 'solana'
type VerificationClaim = { method: string; subject: string; timestamp: string }

function normalizeContactPreference(v: unknown): ContactPreference | null {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (t === 'wallet' || t === 'farcaster' || t === 'email' || t === 'solana') return t
  return null
}

function sanitizeVerifications(input: unknown): VerificationClaim[] {
  if (!Array.isArray(input)) return []
  const out: VerificationClaim[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const method = typeof (raw as any).method === 'string' ? String((raw as any).method).trim() : ''
    const subject = typeof (raw as any).subject === 'string' ? String((raw as any).subject).trim() : ''
    const timestamp = typeof (raw as any).timestamp === 'string' ? String((raw as any).timestamp).trim() : ''
    if (!method || !subject) continue
    out.push({ method, subject, timestamp })
  }
  return out
}

function normalizeReferralCodeOrNull(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null
  const code = normalizeReferralCode(v)
  return code.length > 0 ? code : null
}

async function resolveCreatorCoinSymbolFromWallet(wallet: string): Promise<string | null> {
  const key = (process.env.ZORA_SERVER_API_KEY || '').trim()
  if (!key) return null
  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const profileResp = await sdk.getProfile({ identifier: wallet })
    const creatorCoinAddr = String((profileResp as any)?.data?.profile?.creatorCoin?.address ?? '').trim()
    if (!creatorCoinAddr) return null
    const coinResp = await sdk.getCoin({ address: creatorCoinAddr, chain: 8453 })
    const symbol = String((coinResp as any)?.data?.zora20Token?.symbol ?? '').trim()
    return symbol || null
  } catch {
    return null
  }
}

function getPrivyAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function isPrivyWaitlistEnabled(): boolean {
  const raw = String(
    process.env.PRIVY_WAITLIST_PREGENERATE ??
      process.env.PRIVY_WAITLIST_ENABLED ??
      process.env.VITE_PRIVY_WAITLIST_ENABLED ??
      '',
  )
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function getBasicAuthHeader(appId: string, appSecret: string): string {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`
}

type EmbeddedWalletMeta = {
  address: string | null
  chainType: string | null
  walletClientType: string | null
}

function extractEmbeddedWalletMeta(user: any): EmbeddedWalletMeta {
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const all = [...primaryWallet, ...wallets]
  const normalizeChain = (v: any): string | null => {
    const s = String(v ?? '').trim().toLowerCase()
    return s.length > 0 ? s : null
  }
  const normalizeClientType = (v: any): string | null => {
    const s = String(v ?? '').trim().toLowerCase()
    return s.length > 0 ? s : null
  }
  const parseWallet = (w: any): EmbeddedWalletMeta => {
    const addr = typeof w?.address === 'string' ? w.address : null
    const chainType = normalizeChain(w?.chain_type || w?.chainType)
    const walletClientType = normalizeClientType(w?.wallet_client_type || w?.walletClientType || w?.connector_type || w?.connectorType || w?.type)
    return {
      address: addr && isValidEvmAddress(addr) ? addr : null,
      chainType,
      walletClientType,
    }
  }
  const isEmbedded = (clientType: string | null) =>
    clientType ? clientType.includes('privy') || clientType.includes('embedded') : false

  for (const w of all) {
    const meta = parseWallet(w)
    if (meta.address && isEmbedded(meta.walletClientType)) return meta
  }

  for (const w of all) {
    const meta = parseWallet(w)
    if (!meta.address) continue
    if (!meta.chainType || meta.chainType === 'ethereum') return meta
  }

  return { address: null, chainType: null, walletClientType: null }
}

function extractPrivySolanaWallet(user: any): string | null {
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const all = [...primaryWallet, ...wallets, ...linked]

  for (const wallet of all) {
    const chainType = String(wallet?.chain_type ?? wallet?.chainType ?? wallet?.chain ?? '').trim().toLowerCase()
    const rawAddress = typeof wallet?.address === 'string' ? wallet.address : ''
    const address = rawAddress.trim()
    const type = String(wallet?.type ?? '').trim().toLowerCase()
    if (!address) continue
    if (chainType.includes('solana') || type.includes('solana')) {
      if (isValidSolanaAddress(address)) return address
    }
  }
  return null
}

async function privyGetUserByEmail(params: { appId: string; appSecret: string; email: string }): Promise<any | null> {
  const { appId, appSecret, email } = params
  const url = `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/profiles/email/${encodeURIComponent(email)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getBasicAuthHeader(appId, appSecret),
      'privy-app-id': appId,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Privy get-user failed: HTTP ${res.status}${text ? ` (${text})` : ''}`)
  }
  return await res.json()
}

async function privyCreateUserWithWallets(params: {
  appId: string
  appSecret: string
  email: string
}): Promise<any> {
  const { appId, appSecret, email } = params
  const url = `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/profiles`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(appId, appSecret),
      'privy-app-id': appId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      wallets: [{ chain_type: 'ethereum' }, { chain_type: 'solana' }],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Privy create-user failed: HTTP ${res.status}${text ? ` (${text})` : ''}`)
  }
  return await res.json()
}

async function privyCreateOrGetWaitlistUser(email: string): Promise<{
  privyUserId: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  solanaWallet: string | null
  created: boolean
}> {
  const auth = getPrivyAuth()
  if (!auth)
    return {
      privyUserId: null,
      embeddedWallet: null,
      embeddedWalletChain: null,
      embeddedWalletClientType: null,
      solanaWallet: null,
      created: false,
    }
  if (!isPrivyWaitlistEnabled())
    return {
      privyUserId: null,
      embeddedWallet: null,
      embeddedWalletChain: null,
      embeddedWalletClientType: null,
      solanaWallet: null,
      created: false,
    }

  const existing = await privyGetUserByEmail({ ...auth, email })
  const created = !existing
  const user = existing ?? (await privyCreateUserWithWallets({ ...auth, email }))

  const privyUserId =
    typeof user?.id === 'string'
      ? user.id
      : typeof user?.user?.id === 'string'
        ? user.user.id
        : null

  const embeddedMeta = extractEmbeddedWalletMeta(user?.user ?? user)
  const solanaWallet = extractPrivySolanaWallet(user?.user ?? user)
  return {
    privyUserId,
    embeddedWallet: embeddedMeta.address,
    embeddedWalletChain: embeddedMeta.chainType,
    embeddedWalletClientType: embeddedMeta.walletClientType,
    solanaWallet,
    created,
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 5 signups per minute per IP
  const clientIp = getRateLimitIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('waitlist', clientIp), RATE_LIMITS.waitlistSignup)
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' } satisfies ApiEnvelope<never>)
  }

  let body: WaitlistRequestBody = {}
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as WaitlistRequestBody)
        : (req.body as WaitlistRequestBody) || {}
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const emailRaw = typeof body.email === 'string' ? body.email : ''
  let email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const walletRaw = typeof body.primaryWallet === 'string' ? body.primaryWallet : ''
  const primaryWalletInput = normalizeAddress(walletRaw)
  const principalWalletRaw = readRequestPrincipalAddress(req, { lowercase: false })
  const principalWallet = normalizeAddress(principalWalletRaw)

  let primaryWallet = primaryWalletInput
  if (principalWallet && isValidEvmAddress(principalWallet)) {
    // If the caller did not provide a wallet, bind the signup to the signed-in wallet.
    // If they DID provide one and it doesn't match, do not hard-fail:
    // - This endpoint is used by the marketing waitlist flow which can be used without SIWE.
    // - Users may also have a stale auth token in sessionStorage from a different wallet/app host.
    if (!primaryWallet) {
      primaryWallet = principalWallet
    }
  }

  if (primaryWallet.length > 0 && !isValidEvmAddress(primaryWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid primary wallet address' } satisfies ApiEnvelope<never>)
  }

  const solRaw = typeof body.solanaWallet === 'string' ? body.solanaWallet : ''
  let solanaWallet = String(solRaw || '').trim()
  if (solanaWallet.length > 0 && !isValidSolanaAddress(solanaWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid Solana wallet address' } satisfies ApiEnvelope<never>)
  }

  const subRaw = typeof body.baseSubAccount === 'string' ? body.baseSubAccount : ''
  const baseSubAccount = normalizeAddress(subRaw)
  if (baseSubAccount.length > 0 && !isValidEvmAddress(baseSubAccount)) {
    return res.status(400).json({ success: false, error: 'Invalid Base sub-account address' } satisfies ApiEnvelope<never>)
  }

  // CSW address (linked before signup in new flow)
  const cswRaw = typeof body.cswAddress === 'string' ? body.cswAddress : ''
  const cswAddress = normalizeAddress(cswRaw)
  if (cswAddress.length > 0 && !isValidEvmAddress(cswAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid CSW address' } satisfies ApiEnvelope<never>)
  }

  const persona =
    body.intent && typeof body.intent === 'object' && (body.intent as any).persona === 'creator'
      ? 'creator'
      : body.intent && typeof body.intent === 'object' && (body.intent as any).persona === 'user'
        ? 'user'
        : null
  const hasCreatorCoinRaw =
    body.intent && typeof body.intent === 'object' && typeof (body.intent as any).hasCreatorCoin === 'boolean'
      ? Boolean((body.intent as any).hasCreatorCoin)
      : null
  const farcasterFidRaw =
    body.intent && typeof body.intent === 'object' && typeof (body.intent as any).fid === 'number'
      ? Math.floor(Number((body.intent as any).fid))
      : null
  const farcasterFid = farcasterFidRaw && Number.isFinite(farcasterFidRaw) && farcasterFidRaw > 0 ? farcasterFidRaw : null
  const contactPreference = normalizeContactPreference(body.contactPreference)
  const syntheticEmail = isAnySyntheticEmail(email)

  // Wallet-only onboarding can submit a synthetic fallback email so long as the
  // user has a non-email verification/contact signal.
  if (syntheticEmail && contactPreference === 'email') {
    return res.status(400).json({ success: false, error: 'A real email address is required.' } satisfies ApiEnvelope<never>)
  }
  const verifications = sanitizeVerifications(body.verifications)

  const hasVerificationSignal =
    verifications.length > 0 ||
    (primaryWallet.length > 0 && isValidEvmAddress(primaryWallet)) ||
    (solanaWallet.length > 0 && isValidSolanaAddress(solanaWallet)) ||
    (typeof farcasterFid === 'number' && farcasterFid > 0)

  if (syntheticEmail && !hasVerificationSignal) {
    return res.status(400).json({ success: false, error: 'A real email address is required.' } satisfies ApiEnvelope<never>)
  }
  if (persona === 'creator' && !hasVerificationSignal) {
    return res.status(400).json({ success: false, error: 'Creator verification is required.' } satisfies ApiEnvelope<never>)
  }

  const referralFromBody = normalizeReferralCodeOrNull(body.referralCode)
  const claimReferralCode = normalizeReferralCodeOrNull(body.claimReferralCode)

  const db = await getDb()
  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Waitlist requires DB configuration (DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING).',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db as any)
  } catch (e: any) {
    // If the DB is reachable but schema creation is blocked, fail with a clear operator error.
    const msg = e?.message ? String(e.message) : 'Failed to initialize waitlist schema'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
  // Keep points schema ensured even if this handler is hot-reloaded separately.
  await ensureWaitlistPointsSchema(db as any)

  const ipHash = hashForAttribution(getClientIp(req))
  const uaHash = hashForAttribution(getUserAgent(req))

  let privyUserId: string | null = null
  let embeddedWallet: string | null = null
  let embeddedWalletChain: string | null = null
  let embeddedWalletClientType: string | null = null
  if (!isAnySyntheticEmail(email)) {
    try {
      const privy = await privyCreateOrGetWaitlistUser(email)
      privyUserId = privy.privyUserId
      embeddedWallet = privy.embeddedWallet
      embeddedWalletChain = privy.embeddedWalletChain
      embeddedWalletClientType = privy.embeddedWalletClientType
      if (!solanaWallet && privy.solanaWallet) {
        solanaWallet = privy.solanaWallet
      }
      if (privyUserId || embeddedWallet) {
        console.info(
          'waitlist: privy user',
          JSON.stringify({
            email,
            privyUserId,
            embeddedWallet,
            embeddedWalletChain,
            embeddedWalletClientType,
            solanaWallet: privy.solanaWallet,
            created: privy.created,
          }),
        )
      }
    } catch (e: any) {
      // Privy is optional. If it fails, we still accept the waitlist signup.
      // Surface a minimal warning in logs only (no PII beyond email already provided).
      console.warn('waitlist: privy error', e?.message ? String(e.message) : e)
    }
  }

  // ---------------------------------------------------------------------------
  // Dedup guard: check if a profile already exists for this wallet/privy_user_id
  // with a different (usually synthetic) email. If so, adopt that profile by
  // updating its email to the real one, preventing duplicate rows.
  // ---------------------------------------------------------------------------
  const walletForDedup = primaryWallet.length > 0 ? primaryWallet : null
  const privyForDedup = privyUserId || null
  const embeddedForDedup = embeddedWallet || null
  let adoptedExistingId: number | null = null

  try {
    let existingRow: { id: number; email: string } | null = null

    const findByAddress = async (address: string): Promise<{ id: number; email: string } | null> => {
      const q = await db.sql`
        SELECT p.id, p.email
        FROM profiles p
        WHERE LOWER(p.primary_wallet) = ${address}
           OR LOWER(p.embedded_wallet) = ${address}
           OR LOWER(p.primary_embedded_eoa) = ${address}
           OR LOWER(p.csw_address) = ${address}
           OR LOWER(p.primary_smart_wallet) = ${address}
           OR LOWER(p.base_sub_account) = ${address}
           OR EXISTS (
             SELECT 1
             FROM profile_wallets pw
             WHERE pw.profile_id = p.id
               AND LOWER(pw.address) = ${address}
           )
        ORDER BY
          CASE
            WHEN p.privy_user_id IS NOT NULL THEN 0
            WHEN LOWER(p.email) LIKE '%@noemail.4626.fun' OR LOWER(p.email) LIKE '%@wallet.4626.fun' THEN 3
            WHEN LOWER(p.email) LIKE '%@example.com' THEN 2
            ELSE 1
          END,
          p.updated_at DESC,
          p.created_at ASC
        LIMIT 1;
      `
      return (q?.rows?.[0] as { id: number; email: string } | undefined) ?? null
    }

    const dedupAddressSignals = Array.from(
      new Set(
        [walletForDedup, embeddedForDedup, cswAddress.length > 0 ? cswAddress : null, baseSubAccount.length > 0 ? baseSubAccount : null]
          .filter((v): v is string => Boolean(v)),
      ),
    )

    for (const signal of dedupAddressSignals) {
      existingRow = await findByAddress(signal)
      if (existingRow) break
    }

    if (!existingRow && privyForDedup) {
      const q = await db.sql`
        SELECT id, email FROM profiles
        WHERE privy_user_id = ${privyForDedup}
        ORDER BY created_at ASC LIMIT 1;
      `
      existingRow = (q?.rows?.[0] as { id: number; email: string } | undefined) ?? null
    }

    if (existingRow?.id) {
      const nextEmail = shouldAdoptIncomingEmail(existingRow.email, email) ? email : existingRow.email
      const existingEmailNorm = normalizeEmail(existingRow.email)
      const nextEmailNorm = normalizeEmail(nextEmail)
      // Existing profile found with a different email (likely synthetic).
      // Adopt it: update the email to the real one and merge all fields.
      if (existingEmailNorm !== nextEmailNorm) {
        console.info(
          `waitlist: dedup — adopting profile #${existingRow.id} (${existingRow.email}) → ${nextEmail} for wallet ${walletForDedup ?? embeddedForDedup ?? 'N/A'}`,
        )
      }
      const adopted = await db.sql`
        UPDATE profiles
        SET email = ${nextEmail},
            primary_wallet = COALESCE(${walletForDedup}, primary_wallet),
            solana_wallet = COALESCE(${solanaWallet.length > 0 ? solanaWallet : null}, solana_wallet),
            privy_user_id = COALESCE(${privyUserId}, privy_user_id),
            embedded_wallet = COALESCE(${embeddedWallet}, embedded_wallet),
            embedded_wallet_chain = COALESCE(${embeddedWalletChain}, embedded_wallet_chain),
            embedded_wallet_client_type = COALESCE(${embeddedWalletClientType}, embedded_wallet_client_type),
            base_sub_account = COALESCE(${baseSubAccount.length > 0 ? baseSubAccount : null}, base_sub_account),
            persona = COALESCE(${persona}, persona),
            has_creator_coin = COALESCE(${hasCreatorCoinRaw}, has_creator_coin),
            farcaster_fid = COALESCE(${farcasterFid}, farcaster_fid),
            contact_preference = COALESCE(${contactPreference}, contact_preference),
            verifications = COALESCE(${verifications.length > 0 ? JSON.stringify(verifications) : null}, verifications),
            updated_at = NOW()
        WHERE id = ${existingRow.id}
        RETURNING id, email, referral_code;
      `
      if (adopted?.rows?.[0]?.id) {
        adoptedExistingId = adopted.rows[0].id as number
      }
    }
  } catch (dedupErr: any) {
    // Non-fatal: if dedup check fails, fall through to the normal INSERT path.
    console.warn('waitlist: dedup check error (non-fatal)', dedupErr?.message ?? dedupErr)
  }

  try {
    // If we already adopted an existing profile, use that instead of inserting.
    if (adoptedExistingId) {
      const adopted = await db.sql`
        SELECT id, email, referral_code FROM profiles WHERE id = ${adoptedExistingId};
      `
      const row = (adopted?.rows?.[0] ?? null) as { id?: unknown; email?: unknown; referral_code?: unknown } | null
      if (row?.id) {
        const signupId = typeof row.id === 'number' ? row.id : null

        // Award signup points if not already awarded
        if (signupId) {
          try {
            await awardWaitlistPoints({
              db,
              signupId,
              source: 'waitlist_signup',
              sourceId: `email:${email}`,
              amount: WAITLIST_POINTS.signup,
            })
          } catch { /* idempotent — ignore if already awarded */ }
        }

        // Handle CSW, referral code, referral attribution (same as normal path)
        if (signupId && cswAddress.length > 0) {
          await db.sql`
            UPDATE profiles
            SET csw_address = COALESCE(csw_address, ${cswAddress}),
                primary_wallet = COALESCE(primary_wallet, ${cswAddress})
            WHERE id = ${signupId};
          `
          try {
            await awardWaitlistPoints({
              db,
              signupId,
              source: 'csw_link',
              sourceId: `csw:${cswAddress.toLowerCase()}`,
              amount: WAITLIST_POINTS.linkCsw,
            })
          } catch { /* idempotent */ }
        }

        let referralCodeOut: string | null = typeof row.referral_code === 'string' ? (row.referral_code as string) : null
        if (signupId && !referralCodeOut) {
          const desired =
            claimReferralCode ||
            (primaryWallet.length > 0 ? normalizeReferralCodeOrNull(await resolveCreatorCoinSymbolFromWallet(primaryWallet)) : null) ||
            `C${Number(signupId).toString(36).toUpperCase()}`
          try {
            const up = await db.sql`
              UPDATE profiles
              SET referral_code = ${desired}, referral_claimed_at = NOW()
              WHERE id = ${signupId} AND referral_code IS NULL
              RETURNING referral_code;
            `
            referralCodeOut = typeof up?.rows?.[0]?.referral_code === 'string' ? String(up.rows[0].referral_code) : referralCodeOut
          } catch { /* ignore code collision */ }
        }

        if (signupId && referralFromBody) {
          const ref = await db.sql`
            SELECT id FROM profiles WHERE referral_code = ${referralFromBody} LIMIT 1;
          `
          const referrerId = typeof ref?.rows?.[0]?.id === 'number' ? (ref.rows[0].id as number) : null
          if (referrerId && referrerId !== signupId) {
            await db.sql`
              UPDATE profiles
              SET referred_by_code = ${referralFromBody}, referred_by_signup_id = ${referrerId}
              WHERE id = ${signupId} AND referred_by_signup_id IS NULL;
            `
            const convResult = await db.sql`
              INSERT INTO referral_conversions (
                referral_code, referrer_signup_id, invitee_signup_id,
                ip_hash, ua_hash, session_id, attribution, is_valid, invalid_reason, status, created_at
              ) VALUES (
                ${referralFromBody}, ${referrerId}, ${signupId},
                ${ipHash}, ${uaHash}, NULL, 'last_click', TRUE, NULL, 'signed_up', NOW()
              ) ON CONFLICT (invitee_signup_id) DO NOTHING
              RETURNING id;
            `
            if (convResult?.rows?.[0]?.id) {
              await awardWaitlistPoints({
                db, signupId: referrerId,
                source: 'referral_signup', sourceId: `invitee:${signupId}`,
                amount: WAITLIST_POINTS.referralSignup,
              })
            }
          }
        }

        const data: WaitlistResponse = { created: false, email: String(row.email ?? ''), referralCode: referralCodeOut }

        const provisionWallet = cswAddress.length > 0 ? cswAddress : primaryWallet.length > 0 ? primaryWallet : null
        if (signupId && provisionWallet && persona === 'creator') {
          void preprovisionWaitlistUser(signupId, provisionWallet).catch((err) => {
            console.warn('waitlist: preprovision error', err?.message ? String(err.message) : err)
          })
        }

        return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistResponse>)
      }
    }

    // Preferred schema (includes persona + has_creator_coin).
    const r = await db.sql`
      INSERT INTO profiles (
        email,
        primary_wallet,
        solana_wallet,
        privy_user_id,
        embedded_wallet,
        embedded_wallet_chain,
        embedded_wallet_client_type,
        base_sub_account,
        persona,
        has_creator_coin,
        farcaster_fid,
        contact_preference,
        verifications,
        created_at,
        updated_at
      )
      VALUES (
        ${email},
        ${primaryWallet.length > 0 ? primaryWallet : null},
        ${solanaWallet.length > 0 ? solanaWallet : null},
        ${privyUserId},
        ${embeddedWallet},
        ${embeddedWalletChain},
        ${embeddedWalletClientType},
        ${baseSubAccount.length > 0 ? baseSubAccount : null},
        ${persona},
        ${hasCreatorCoinRaw},
        ${farcasterFid},
        ${contactPreference},
        ${verifications.length > 0 ? JSON.stringify(verifications) : null},
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE
        SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
            solana_wallet = COALESCE(EXCLUDED.solana_wallet, profiles.solana_wallet),
            privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
            embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, profiles.embedded_wallet),
            embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, profiles.embedded_wallet_chain),
            embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, profiles.embedded_wallet_client_type),
            base_sub_account = COALESCE(EXCLUDED.base_sub_account, profiles.base_sub_account),
            persona = COALESCE(EXCLUDED.persona, profiles.persona),
            has_creator_coin = COALESCE(EXCLUDED.has_creator_coin, profiles.has_creator_coin),
            farcaster_fid = COALESCE(EXCLUDED.farcaster_fid, profiles.farcaster_fid),
            contact_preference = COALESCE(EXCLUDED.contact_preference, profiles.contact_preference),
            verifications = COALESCE(EXCLUDED.verifications, profiles.verifications),
            updated_at = NOW()
      RETURNING id, (xmax = 0) AS created, email, referral_code;
    `

    const row = (r?.rows?.[0] ?? null) as { id?: unknown; created?: unknown; email?: unknown; referral_code?: unknown } | null
    if (!row) throw new Error('Insert failed')

    const signupId = typeof row.id === 'number' ? (row.id as number) : null
    const created = Boolean(row.created)

    // Babylon-style: award points immediately on join (idempotent via ledger unique key).
    if (signupId && created) {
      await awardWaitlistPoints({
        db,
        signupId,
        source: 'waitlist_signup',
        sourceId: `email:${email}`,
        amount: WAITLIST_POINTS.signup,
      })
    }

    // Award CSW linking points if CSW was linked before signup
    if (signupId && cswAddress.length > 0) {
      // Update the signup record with CSW address (store in dedicated csw_address column)
      await db.sql`
        UPDATE profiles
        SET csw_address = COALESCE(csw_address, ${cswAddress}),
            primary_wallet = COALESCE(primary_wallet, ${cswAddress})
        WHERE id = ${signupId};
      `
      // Award CSW points (idempotent)
      await awardWaitlistPoints({
        db,
        signupId,
        source: 'csw_link',
        sourceId: `csw:${cswAddress.toLowerCase()}`,
        amount: WAITLIST_POINTS.linkCsw,
      })
    }

    // Everyone gets a referral code (Babylon-style).
    let referralCodeOut: string | null = typeof row.referral_code === 'string' ? (row.referral_code as string) : null
    if (signupId && !referralCodeOut) {
      const desired =
        claimReferralCode ||
        (primaryWallet.length > 0 ? normalizeReferralCodeOrNull(await resolveCreatorCoinSymbolFromWallet(primaryWallet)) : null) ||
        `C${Number(signupId).toString(36).toUpperCase()}`
      try {
        const up = await db.sql`
          UPDATE profiles
          SET referral_code = ${desired}, referral_claimed_at = NOW()
          WHERE id = ${signupId} AND referral_code IS NULL
          RETURNING referral_code;
        `
        const claimed = typeof up?.rows?.[0]?.referral_code === 'string' ? String(up.rows[0].referral_code) : null
        referralCodeOut = claimed || referralCodeOut
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : ''
        if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
          // If the user explicitly tried to claim a code and it collided, surface the error.
          if (claimReferralCode) {
            return res.status(409).json({
              success: false,
              error: 'Referral code is taken. Choose a different code.',
              code: 'REFERRAL_CODE_TAKEN',
              suggested: desired,
            } as any)
          }
          // Otherwise ignore (we'll just proceed without a code).
        }
      }
    }

    // If the signup came with a referral code, attribute conversion (best-effort).
    if (signupId && referralFromBody) {
      const ref = await db.sql`
        SELECT id
        FROM profiles
        WHERE referral_code = ${referralFromBody}
        LIMIT 1;
      `
      const referrerId = typeof ref?.rows?.[0]?.id === 'number' ? (ref.rows[0].id as number) : null
      if (referrerId && referrerId !== signupId) {
        // Link invitee to referrer (do not overwrite if already set).
        await db.sql`
          UPDATE profiles
          SET referred_by_code = ${referralFromBody}, referred_by_signup_id = ${referrerId}
          WHERE id = ${signupId} AND referred_by_signup_id IS NULL;
        `
        // Insert conversion (one per invitee). If it already exists, ignore.
        const conversionResult = await db.sql`
          INSERT INTO referral_conversions (
            referral_code,
            referrer_signup_id,
            invitee_signup_id,
            ip_hash,
            ua_hash,
            session_id,
            attribution,
            is_valid,
            invalid_reason,
            status,
            created_at
          )
          VALUES (
            ${referralFromBody},
            ${referrerId},
            ${signupId},
            ${ipHash},
            ${uaHash},
            NULL,
            'last_click',
            TRUE,
            NULL,
            'signed_up',
            NOW()
          )
          ON CONFLICT (invitee_signup_id) DO NOTHING
          RETURNING id;
        `
        // Award referrer signup points (only if this was a new conversion)
        if (conversionResult?.rows?.[0]?.id) {
          await awardWaitlistPoints({
            db,
            signupId: referrerId,
            source: 'referral_signup',
            sourceId: `invitee:${signupId}`,
            amount: WAITLIST_POINTS.referralSignup,
          })
        }
      }
    }

    const data: WaitlistResponse = { created, email: String(row.email ?? ''), referralCode: referralCodeOut }

    // Fire-and-forget: pre-provision server wallet + resolve identities.
    // This runs after the response so it doesn't block signup.
    const provisionWallet = cswAddress.length > 0 ? cswAddress : primaryWallet.length > 0 ? primaryWallet : null
    if (signupId && provisionWallet && persona === 'creator') {
      void preprovisionWaitlistUser(signupId, provisionWallet).catch((err) => {
        console.warn('waitlist: preprovision error', err?.message ? String(err.message) : err)
      })
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistResponse>)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Waitlist insert failed'
    const lower = String(msg).toLowerCase()

    // If the table didn't exist (or was dropped), try to recreate and retry once.
    if (lower.includes('relation') && lower.includes('profiles')) {
      try {
        await ensureWaitlistSchema(db as any)
        const rRetry = await db.sql`
          INSERT INTO profiles (
            email,
            primary_wallet,
            solana_wallet,
            privy_user_id,
            embedded_wallet,
            embedded_wallet_chain,
            embedded_wallet_client_type,
            base_sub_account,
            persona,
            has_creator_coin,
            farcaster_fid,
            contact_preference,
            verifications,
            created_at,
            updated_at
          )
          VALUES (
            ${email},
            ${primaryWallet.length > 0 ? primaryWallet : null},
            ${solanaWallet.length > 0 ? solanaWallet : null},
            ${privyUserId},
            ${embeddedWallet},
            ${embeddedWalletChain},
            ${embeddedWalletClientType},
            ${baseSubAccount.length > 0 ? baseSubAccount : null},
            ${persona},
            ${hasCreatorCoinRaw},
            ${farcasterFid},
            ${contactPreference},
            ${verifications.length > 0 ? JSON.stringify(verifications) : null},
            NOW(),
            NOW()
          )
          ON CONFLICT (email) DO UPDATE
            SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
                solana_wallet = COALESCE(EXCLUDED.solana_wallet, profiles.solana_wallet),
                privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
                embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, profiles.embedded_wallet),
                embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, profiles.embedded_wallet_chain),
                embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, profiles.embedded_wallet_client_type),
                base_sub_account = COALESCE(EXCLUDED.base_sub_account, profiles.base_sub_account),
                persona = COALESCE(EXCLUDED.persona, profiles.persona),
                has_creator_coin = COALESCE(EXCLUDED.has_creator_coin, profiles.has_creator_coin),
                farcaster_fid = COALESCE(EXCLUDED.farcaster_fid, profiles.farcaster_fid),
                contact_preference = COALESCE(EXCLUDED.contact_preference, profiles.contact_preference),
                verifications = COALESCE(EXCLUDED.verifications, profiles.verifications),
                updated_at = NOW()
          RETURNING (xmax = 0) AS created, email;
        `
        const rowRetry = (rRetry?.rows?.[0] ?? null) as { created?: unknown; email?: unknown } | null
        if (!rowRetry) throw new Error('Insert failed')
        const dataRetry: WaitlistResponse = { created: Boolean(rowRetry.created), email: String(rowRetry.email ?? '') }
        return res.status(200).json({ success: true, data: dataRetry } satisfies ApiEnvelope<WaitlistResponse>)
      } catch (eRetry: any) {
        const msgRetry = eRetry instanceof Error ? eRetry.message : msg
        return res.status(500).json({ success: false, error: String(msgRetry) } satisfies ApiEnvelope<never>)
      }
    }

    // Back-compat: if the DB table exists but hasn't been migrated with new columns yet,
    // retry without persona columns so signups still work.
    if (
      lower.includes('column') &&
      (lower.includes('persona') ||
        lower.includes('has_creator_coin') ||
        lower.includes('farcaster_fid') ||
        lower.includes('embedded_wallet_chain') ||
        lower.includes('embedded_wallet_client_type') ||
        lower.includes('contact_preference') ||
        lower.includes('verifications') ||
        lower.includes('base_sub_account'))
    ) {
      try {
        const r2 = await db.sql`
          INSERT INTO profiles (email, primary_wallet, privy_user_id, embedded_wallet, created_at, updated_at)
          VALUES (${email}, ${primaryWallet.length > 0 ? primaryWallet : null}, ${privyUserId}, ${embeddedWallet}, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE
            SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
                privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
                embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, profiles.embedded_wallet),
                updated_at = NOW()
          RETURNING (xmax = 0) AS created, email;
        `
        const row2 = (r2?.rows?.[0] ?? null) as { created?: unknown; email?: unknown } | null
        if (!row2) throw new Error('Insert failed')
        const data2: WaitlistResponse = { created: Boolean(row2.created), email: String(row2.email ?? '') }
        return res.status(200).json({ success: true, data: data2 } satisfies ApiEnvelope<WaitlistResponse>)
      } catch (e2: any) {
        const msg2 = e2 instanceof Error ? e2.message : msg
        return res.status(500).json({ success: false, error: String(msg2) } satisfies ApiEnvelope<never>)
      }
    }

    // Helpful hint if the table hasn't been created yet.
    const hint =
      lower.includes('relation') && lower.includes('profiles')
        ? 'Missing table. Create `profiles` (see docs) and retry.'
        : null
    return res.status(500).json({ success: false, error: hint ? `${msg}. ${hint}` : msg } satisfies ApiEnvelope<never>)
  }
}
