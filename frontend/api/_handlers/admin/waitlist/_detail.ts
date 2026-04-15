import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrivyClient } from '@privy-io/server-auth'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
} from '../../../../packages/server-core/src/index.js'



import { normalizeReferralCode } from '../../../../server/_lib/referrals.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/db/supabaseAdmin.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'

const DEFAULT_BASE_RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com']

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

type WalletGraphItem = {
  address: string
  walletType: string | null
  provider: string | null
  chain: string | null
  isPrimary: boolean
  isCanonicalSmartWallet: boolean
  isEmbeddedEoa: boolean
}

type PrivyWalletContext = {
  embeddedWallet4626: string | null
  embeddedWalletZora: string | null
  privySmartWallet: string | null
  crossAppEmbeddedWallets: string[]
  crossAppSmartWallets: string[]
}

type WaitlistDetail = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  solanaWallet: string | null
  privyUserId: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  baseSubAccount: string | null
  hasCreatorCoin: boolean | null
  contactPreference: string | null
  verifications: unknown | null
  appAccessStatus: string | null
  appAccessDecisionNote: string | null
  appAccessDecidedAt: string | null
  appAccessDecidedBy: string | null
  referralCode: string | null
  referredByCode: string | null
  referredBySignupId: number | null
  referralClaimedAt: string | null
  profileCompletedAt: string | null
  cswAddress: string | null
  createdAt: string
  updatedAt: string
  // Pre-provisioning data
  preprovisionedAt: string | null
  preprovServerWalletId: string | null
  preprovServerWalletAddress: string | null
  preprovCoinAddress: string | null
  preprovCoinSymbol: string | null
  preprovZoraHandle: string | null
  walletGraph: WalletGraphItem[]
  resolvedPrimaryWallet: string | null
  resolvedCswAddress: string | null
  resolvedCswOwners: string[]
  embeddedWallet4626: string | null
  embeddedWalletZora: string | null
  privySmartWallet: string | null
  crossAppEmbeddedWallets: string[]
  crossAppSmartWallets: string[]
}

type DetailResponse = {
  admin: string
  signup: WaitlistDetail | null
}

function toIso(value: any): string | null {
  if (!value) return null
  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return DEFAULT_BASE_RPCS
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return [...new Set(urls)]
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

function uniqueAddresses(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeAddress(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function decodeOwnerAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.toLowerCase() : ''
  if (!raw.startsWith('0x')) return null
  if (raw.length === 42) return normalizeAddress(raw)
  if (raw.length === 66) return normalizeAddress(`0x${raw.slice(-40)}`)
  return null
}

function readLinkedAccounts(user: any): any[] {
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const linkedAccountsSnake = Array.isArray(user?.linked_accounts) ? user.linked_accounts : []
  return [...linkedAccounts, ...linkedAccountsSnake]
}

async function fetchPrivyWalletContext(privyUserId: string | null): Promise<PrivyWalletContext> {
  const fallback: PrivyWalletContext = {
    embeddedWallet4626: null,
    embeddedWalletZora: null,
    privySmartWallet: null,
    crossAppEmbeddedWallets: [],
    crossAppSmartWallets: [],
  }
  if (!privyUserId) return fallback

  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return fallback

  try {
    const client = new PrivyClient(appId, appSecret)
    const user: any = await client.getUserById(privyUserId)
    const linked = readLinkedAccounts(user)

    const embeddedWallet4626 = normalizeAddress(user?.wallet?.address)
    const linkedEmbedded = uniqueAddresses(
      linked
        .filter((account) => String(account?.type || '').toLowerCase() === 'wallet')
        .filter((account) => {
          const clientType = String(account?.walletClientType ?? account?.wallet_client_type ?? '').toLowerCase()
          const connector = String(account?.connectorType ?? account?.connector_type ?? '').toLowerCase()
          return clientType.includes('privy') || connector.includes('embedded')
        })
        .map((account) => account?.address),
    )

    const privySmartWallet = normalizeAddress(
      linked.find((account) => String(account?.type || '').toLowerCase() === 'smart_wallet')?.address ??
        null,
    )

    const crossAppEmbeddedWallets = uniqueAddresses(
      linked
        .filter((account) => String(account?.type || '').toLowerCase() === 'cross_app')
        .flatMap((account) => (Array.isArray(account?.embeddedWallets) ? account.embeddedWallets : []))
        .map((wallet) => wallet?.address),
    )

    const crossAppSmartWallets = uniqueAddresses(
      linked
        .filter((account) => String(account?.type || '').toLowerCase() === 'cross_app')
        .flatMap((account) => (Array.isArray(account?.smartWallets) ? account.smartWallets : []))
        .map((wallet) => wallet?.address),
    )

    const embeddedWalletZora =
      crossAppEmbeddedWallets.find((address) => address !== embeddedWallet4626) ??
      linkedEmbedded.find((address) => address !== embeddedWallet4626) ??
      null

    return {
      embeddedWallet4626: embeddedWallet4626 ?? linkedEmbedded[0] ?? null,
      embeddedWalletZora,
      privySmartWallet,
      crossAppEmbeddedWallets,
      crossAppSmartWallets,
    }
  } catch {
    return fallback
  }
}

function extractVerificationSubjects(verifications: unknown): string[] {
  if (!Array.isArray(verifications)) return []
  return uniqueAddresses(
    verifications.map((entry: any) => (typeof entry?.subject === 'string' ? entry.subject : null)),
  )
}

async function fetchWalletGraph(db: any, profileId: number): Promise<WalletGraphItem[]> {
  if (db?.query) {
    const result = await db.query(
      `SELECT
         pw.address,
         pw.is_primary,
         pw.is_canonical_smart_wallet,
         pw.is_embedded_eoa,
         w.wallet_type,
         w.provider,
         w.chain
       FROM profile_wallets pw
       LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
       WHERE pw.profile_id = $1
       ORDER BY pw.is_primary DESC, pw.is_canonical_smart_wallet DESC, pw.updated_at DESC;`,
      [profileId],
    )

    return (result.rows ?? [])
      .map((row: any) => {
        const address = normalizeAddress(row.address)
        if (!address) return null
        return {
          address,
          walletType: typeof row.wallet_type === 'string' ? row.wallet_type : null,
          provider: typeof row.provider === 'string' ? row.provider : null,
          chain: typeof row.chain === 'string' ? row.chain : null,
          isPrimary: Boolean(row.is_primary),
          isCanonicalSmartWallet: Boolean(row.is_canonical_smart_wallet),
          isEmbeddedEoa: Boolean(row.is_embedded_eoa),
        } satisfies WalletGraphItem
      })
      .filter(Boolean) as WalletGraphItem[]
  }
  if (!db?.from) return []

  const { data: profileWalletRows, error: pwError } = await db
    .from('profile_wallets')
    .select('address,is_primary,is_canonical_smart_wallet,is_embedded_eoa,updated_at')
    .eq('profile_id', profileId)
    .order('is_primary', { ascending: false })
    .order('is_canonical_smart_wallet', { ascending: false })
    .order('updated_at', { ascending: false })
  if (pwError) return []

  const addresses = uniqueAddresses((profileWalletRows ?? []).map((row: any) => row?.address))
  const walletMap = new Map<string, any>()
  if (addresses.length > 0) {
    const { data: walletRows } = await db.from('wallets').select('address,wallet_type,provider,chain').in('address', addresses)
    for (const row of walletRows ?? []) {
      const address = normalizeAddress((row as any)?.address)
      if (!address) continue
      walletMap.set(address, row)
    }
  }

  return (profileWalletRows ?? [])
    .map((row: any) => {
      const address = normalizeAddress(row?.address)
      if (!address) return null
      const wallet = walletMap.get(address) ?? {}
      return {
        address,
        walletType: typeof wallet.wallet_type === 'string' ? wallet.wallet_type : null,
        provider: typeof wallet.provider === 'string' ? wallet.provider : null,
        chain: typeof wallet.chain === 'string' ? wallet.chain : null,
        isPrimary: Boolean(row?.is_primary),
        isCanonicalSmartWallet: Boolean(row?.is_canonical_smart_wallet),
        isEmbeddedEoa: Boolean(row?.is_embedded_eoa),
      } satisfies WalletGraphItem
    })
    .filter(Boolean) as WalletGraphItem[]
}

async function fetchSmartWalletOwners(smartWallet: string): Promise<string[]> {
  const rpcs = getBaseRpcUrls()
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })
      const countRaw = (await client.readContract({
        address: smartWallet as `0x${string}`,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerCount',
      })) as bigint

      const count = Number(countRaw)
      if (!Number.isFinite(count) || count <= 0) return []

      let upperBound = count
      try {
        const nextRaw = (await client.readContract({
          address: smartWallet as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'nextOwnerIndex',
        })) as bigint
        const next = Number(nextRaw)
        if (Number.isFinite(next) && next > 0) upperBound = next
      } catch {
        // ignore and use ownerCount
      }

      const maxScan = Math.min(Math.max(upperBound, count), 24)
      const owners: string[] = []
      const seen = new Set<string>()
      for (let i = 0; i < maxScan; i++) {
        try {
          const ownerBytes = (await client.readContract({
            address: smartWallet as `0x${string}`,
            abi: COINBASE_SMART_WALLET_OWNERS_ABI,
            functionName: 'ownerAtIndex',
            args: [BigInt(i)],
          })) as string
          const owner = decodeOwnerAddress(ownerBytes)
          if (!owner || seen.has(owner)) continue
          seen.add(owner)
          owners.push(owner)
        } catch {
          // continue
        }
      }
      return owners
    } catch {
      // try next RPC
    }
  }
  return []
}

async function fetchPrimaryWalletMatches(db: any, addresses: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (addresses.length === 0) return out
  if (db?.query) {
    const result = await db.query(
      `SELECT LOWER(primary_wallet) AS primary_wallet
       FROM profiles
       WHERE LOWER(primary_wallet) = ANY($1);`,
      [addresses],
    )
    for (const row of result.rows ?? []) {
      const address = normalizeAddress(row.primary_wallet)
      if (address) out.add(address)
    }
    return out
  }
  if (!db?.from) return out
  const clauses = addresses.map((address) => `primary_wallet.ilike.${address}`)
  const { data } = await db.from('profiles').select('primary_wallet').or(clauses.join(','))
  for (const row of data ?? []) {
    const address = normalizeAddress((row as any)?.primary_wallet)
    if (address) out.add(address)
  }
  return out
}

function pickPreferredOwner(params: {
  owners: string[]
  ownerPrimaryMatches: Set<string>
  embeddedWallet4626: string | null
  verificationSubjects: string[]
}): string | null {
  const { owners, ownerPrimaryMatches, embeddedWallet4626, verificationSubjects } = params
  if (owners.length === 0) return null
  const notEmbedded = owners.filter((owner) => owner !== embeddedWallet4626)
  const preferredPrimary = notEmbedded.find((owner) => ownerPrimaryMatches.has(owner))
  if (preferredPrimary) return preferredPrimary
  const preferredVerification = notEmbedded.find((owner) => verificationSubjects.includes(owner))
  if (preferredVerification) return preferredVerification
  return notEmbedded[0] ?? owners[0] ?? null
}

async function resolveIdentity(params: {
  dataSource: any
  row: any
  walletGraph: WalletGraphItem[]
  privyContext: PrivyWalletContext
}): Promise<{
  resolvedPrimaryWallet: string | null
  resolvedCswAddress: string | null
  resolvedCswOwners: string[]
}> {
  const { dataSource, row, walletGraph, privyContext } = params
  const verificationSubjects = extractVerificationSubjects(row.verifications)

  const candidateScores = new Map<string, number>()
  const addCandidate = (value: unknown, score: number) => {
    const address = normalizeAddress(value)
    if (!address) return
    const current = candidateScores.get(address) ?? 0
    candidateScores.set(address, Math.max(current, score))
  }

  addCandidate(row.primary_smart_wallet, 4)
  addCandidate(row.csw_address, 4)
  addCandidate(row.base_sub_account, 3)
  addCandidate(privyContext.privySmartWallet, 2)
  for (const wallet of privyContext.crossAppSmartWallets) addCandidate(wallet, 2)
  for (const wallet of walletGraph) {
    if (wallet.walletType === 'smart_wallet') addCandidate(wallet.address, wallet.isCanonicalSmartWallet ? 5 : 2)
    if (wallet.isCanonicalSmartWallet) addCandidate(wallet.address, 5)
  }

  const candidates = Array.from(candidateScores.entries()).map(([address, score]) => ({ address, baseScore: score }))
  if (candidates.length === 0) {
    return {
      resolvedPrimaryWallet: normalizeAddress(row.primary_wallet) ?? null,
      resolvedCswAddress: null,
      resolvedCswOwners: [],
    }
  }

  const snapshots: Array<{ address: string; owners: string[]; baseScore: number }> = []
  for (const candidate of candidates) {
    const owners = await fetchSmartWalletOwners(candidate.address)
    snapshots.push({ address: candidate.address, owners, baseScore: candidate.baseScore })
  }

  const ownerUniverse = uniqueAddresses(snapshots.flatMap((snapshot) => snapshot.owners))
  const ownerPrimaryMatches = await fetchPrimaryWalletMatches(dataSource, ownerUniverse)
  const embeddedWallet4626 =
    normalizeAddress(privyContext.embeddedWallet4626) ??
    normalizeAddress(row.primary_embedded_eoa) ??
    normalizeAddress(row.embedded_wallet)

  const ranked = snapshots
    .map((snapshot) => {
      let score = snapshot.baseScore
      if (snapshot.owners.length >= 2) score += 1
      if (embeddedWallet4626 && snapshot.owners.includes(embeddedWallet4626)) score += 1
      if (snapshot.owners.some((owner) => verificationSubjects.includes(owner))) score += 2
      if (snapshot.owners.some((owner) => owner !== embeddedWallet4626 && ownerPrimaryMatches.has(owner))) score += 3
      return { ...snapshot, score }
    })
    .sort((a, b) => b.score - a.score || b.owners.length - a.owners.length || b.baseScore - a.baseScore)

  const best = ranked[0]
  const resolvedCswAddress = best?.address ?? null
  const resolvedCswOwners = best?.owners ?? []

  const preferredOwner = pickPreferredOwner({
    owners: resolvedCswOwners,
    ownerPrimaryMatches,
    embeddedWallet4626,
    verificationSubjects,
  })

  const primaryFromProfile = normalizeAddress(row.primary_wallet)
  const resolvedPrimaryWallet =
    preferredOwner ??
    (primaryFromProfile && primaryFromProfile !== resolvedCswAddress ? primaryFromProfile : null) ??
    embeddedWallet4626 ??
    null

  return { resolvedPrimaryWallet, resolvedCswAddress, resolvedCswOwners }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const idRaw = typeof (req.query as any)?.id === 'string' ? String((req.query as any).id) : ''
  const emailRaw = typeof (req.query as any)?.email === 'string' ? String((req.query as any).email) : ''
  const refRaw = typeof (req.query as any)?.ref === 'string' ? String((req.query as any).ref) : ''

  const id = idRaw ? Number(idRaw) : NaN
  const email = emailRaw.trim()
  const referral = refRaw ? normalizeReferralCode(refRaw) : ''

  if (!Number.isFinite(id) && !email && !referral) {
    return res.status(400).json({ success: false, error: 'Missing id, email, or ref' } satisfies ApiEnvelope<never>)
  }

  const db = isDbConfigured() ? await getDb() : null
  const supabase = isSupabaseAdminConfigured() ? getSupabaseAdmin() : null
  const dataSource = db?.query ? db : supabase
  if (!dataSource) {
    return res.status(500).json({
      success: false,
      error: 'Database not configured (set POSTGRES_URL/DATABASE_URL or Supabase admin env vars).',
    } satisfies ApiEnvelope<never>)
  }

  if (db?.query) {
    await ensureWaitlistSchema(db as any)
  }

  let row: any | null = null

  if (db?.query) {
    if (Number.isFinite(id)) {
      const q = await db.query(
        `SELECT *
         FROM profiles
         WHERE id = $1
         LIMIT 1;`,
        [Math.floor(id)],
      )
      row = q.rows?.[0] ?? null
    } else if (email) {
      const q = await db.query(
        `SELECT *
         FROM profiles
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1;`,
        [email],
      )
      row = q.rows?.[0] ?? null
    } else if (referral) {
      const q = await db.query(
        `SELECT *
         FROM profiles
         WHERE referral_code = $1
         LIMIT 1;`,
        [referral],
      )
      row = q.rows?.[0] ?? null
    }
  } else if (supabase) {
    let query = supabase.from('profiles').select('*').limit(1)
    if (Number.isFinite(id)) {
      query = query.eq('id', Math.floor(id))
    } else if (email) {
      query = query.ilike('email', email)
    } else if (referral) {
      query = query.eq('referral_code', referral)
    }
    const { data, error } = await query.maybeSingle()
    if (error) {
      return res.status(500).json({
        success: false,
        error: `Supabase query failed: ${error.message}`,
      } satisfies ApiEnvelope<never>)
    }
    row = data ?? null
  }

  if (!row) {
    return res.status(200).json({ success: true, data: { admin, signup: null } satisfies DetailResponse } satisfies ApiEnvelope<DetailResponse>)
  }

  const profileId = typeof row.id === 'number' ? row.id : Number(row.id)
  const walletGraph = await fetchWalletGraph(dataSource, profileId)
  const privyContext = await fetchPrivyWalletContext(typeof row.privy_user_id === 'string' ? row.privy_user_id : null)
  const resolvedIdentity = await resolveIdentity({ dataSource, row, walletGraph, privyContext })

  const detail: WaitlistDetail = {
    id: profileId,
    email: typeof row.email === 'string' ? row.email : String(row.email || ''),
    persona: typeof row.persona === 'string' ? row.persona : null,
    primaryWallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    solanaWallet: typeof row.solana_wallet === 'string' ? row.solana_wallet : null,
    privyUserId: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
    embeddedWallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    embeddedWalletChain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : null,
    embeddedWalletClientType: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    baseSubAccount: typeof row.base_sub_account === 'string' ? row.base_sub_account : null,
    hasCreatorCoin: typeof row.has_creator_coin === 'boolean' ? row.has_creator_coin : row.has_creator_coin === null ? null : Boolean(row.has_creator_coin),
    contactPreference: typeof row.contact_preference === 'string' ? row.contact_preference : null,
    verifications: row.verifications ?? null,
    appAccessStatus: typeof row.app_access_status === 'string' ? row.app_access_status : null,
    appAccessDecisionNote: typeof row.app_access_decision_note === 'string' ? row.app_access_decision_note : null,
    appAccessDecidedAt: toIso(row.app_access_decided_at),
    appAccessDecidedBy: typeof row.app_access_decided_by === 'string' ? row.app_access_decided_by : null,
    referralCode: typeof row.referral_code === 'string' ? row.referral_code : null,
    referredByCode: typeof row.referred_by_code === 'string' ? row.referred_by_code : null,
    referredBySignupId:
      typeof row.referred_by_signup_id === 'number'
        ? row.referred_by_signup_id
        : row.referred_by_signup_id
          ? Number(row.referred_by_signup_id)
          : null,
    referralClaimedAt: toIso(row.referral_claimed_at),
    profileCompletedAt: toIso(row.profile_completed_at),
    cswAddress: typeof row.csw_address === 'string' ? row.csw_address : null,
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
    // Pre-provisioning data
    preprovisionedAt: toIso(row.preprovisioned_at),
    preprovServerWalletId: typeof row.preprov_server_wallet_id === 'string' ? row.preprov_server_wallet_id : null,
    preprovServerWalletAddress: typeof row.preprov_server_wallet_address === 'string' ? row.preprov_server_wallet_address : null,
    preprovCoinAddress: typeof row.preprov_coin_address === 'string' ? row.preprov_coin_address : null,
    preprovCoinSymbol: typeof row.preprov_coin_symbol === 'string' ? row.preprov_coin_symbol : null,
    preprovZoraHandle: typeof row.preprov_zora_handle === 'string' ? row.preprov_zora_handle : null,
    walletGraph,
    resolvedPrimaryWallet: resolvedIdentity.resolvedPrimaryWallet,
    resolvedCswAddress: resolvedIdentity.resolvedCswAddress,
    resolvedCswOwners: resolvedIdentity.resolvedCswOwners,
    embeddedWallet4626:
      privyContext.embeddedWallet4626 ??
      (typeof row.primary_embedded_eoa === 'string' ? row.primary_embedded_eoa : null) ??
      (typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null),
    embeddedWalletZora: privyContext.embeddedWalletZora,
    privySmartWallet: privyContext.privySmartWallet,
    crossAppEmbeddedWallets: privyContext.crossAppEmbeddedWallets,
    crossAppSmartWallets: privyContext.crossAppSmartWallets,
  }

  return res.status(200).json({
    success: true,
    data: { admin, signup: detail } satisfies DetailResponse,
  } satisfies ApiEnvelope<DetailResponse>)
}
