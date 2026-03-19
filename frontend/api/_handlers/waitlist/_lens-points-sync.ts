import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import { resolveLensUserByOwner } from '../../../server/_lib/lensAccounts.js'
import { getGroveChainId, tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'

type Body = { email?: string }

type LensPointsSyncResponse = {
  email: string
  lensHandle: string | null
  lensAccountAddress: string | null
  lensOwnerAddress: string | null
  lensGroveUri: string | null
  awardedLensPoints: number
  awardedGrovePoints: number
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function normalizeAddress(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return null
  return s.toLowerCase()
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const me = await db.sql`
    SELECT id, primary_wallet, embedded_wallet, csw_address
    FROM profiles
    WHERE email = ${email}
    LIMIT 1;
  `
  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? row.id : null
  if (!signupId) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const authorized = await isAuthorizedWalletForProfile({
    db: db as any,
    profileId: signupId,
    address: principalAddress,
  })
  if (!authorized) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this profile' } satisfies ApiEnvelope<never>)
  }

  const ownerCandidates = [
    normalizeAddress(row?.primary_wallet),
    normalizeAddress(row?.embedded_wallet),
    normalizeAddress(row?.csw_address),
  ].filter(Boolean) as string[]

  let lensUser: Awaited<ReturnType<typeof resolveLensUserByOwner>> = null
  for (const owner of ownerCandidates) {
    lensUser = await resolveLensUserByOwner(owner)
    if (lensUser) break
  }

  if (!lensUser) {
    return res.status(404).json({ success: false, error: 'No Lens account linked to this profile wallets yet' } satisfies ApiEnvelope<never>)
  }

  const lensSnapshot = {
    source: 'waitlist.lens.sync',
    syncedAt: new Date().toISOString(),
    email,
    lens: {
      handle: lensUser.handle,
      username: lensUser.username,
      displayName: lensUser.displayName,
      accountAddress: lensUser.accountAddress,
      ownerAddress: lensUser.ownerAddress,
      avatar: lensUser.avatar,
    },
  }

  let lensGroveUri: string | null = null
  let awardedGrovePoints = 0
  const groveAttempt = await tryUploadImmutableJson(lensSnapshot, getGroveChainId())
  if (groveAttempt.ok) {
    lensGroveUri = groveAttempt.result.lensUri
    awardedGrovePoints = WAITLIST_POINTS.groveProof
    await awardWaitlistPoints({
      db,
      signupId,
      source: 'grove_proof',
      sourceId: `lens:${lensUser.accountAddress.toLowerCase()}:grove`,
      amount: awardedGrovePoints,
    })
  }

  const awardedLensPoints = WAITLIST_POINTS.lensIdentity
  await awardWaitlistPoints({
    db,
    signupId,
    source: 'lens_identity',
    sourceId: `lens:${lensUser.accountAddress.toLowerCase()}`,
    amount: awardedLensPoints,
  })

  await db.sql`
    UPDATE profiles
    SET
      lens_handle = ${lensUser.handle},
      lens_account_address = ${lensUser.accountAddress},
      lens_owner_address = ${lensUser.ownerAddress},
      lens_grove_uri = COALESCE(${lensGroveUri}, lens_grove_uri),
      updated_at = NOW()
    WHERE id = ${signupId};
  `

  const data: LensPointsSyncResponse = {
    email,
    lensHandle: lensUser.handle,
    lensAccountAddress: lensUser.accountAddress,
    lensOwnerAddress: lensUser.ownerAddress,
    lensGroveUri,
    awardedLensPoints,
    awardedGrovePoints,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<LensPointsSyncResponse>)
}
