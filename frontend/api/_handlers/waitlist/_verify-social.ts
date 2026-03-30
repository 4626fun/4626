import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import { checkRateLimit, rateLimitKey, getClientIp } from '../../../server/_lib/rateLimit.js'

declare const process: { env: Record<string, string | undefined> }

type SocialPlatform = 'discord' | 'telegram'

type Body = {
  email?: string
  platform?: SocialPlatform
  // Platform-specific identifiers
  discordUserId?: string // Discord user ID
  telegramUserId?: string // Telegram user ID
}

type VerifySocialResponse = {
  email: string
  platform: SocialPlatform
  verified: boolean
  awarded: boolean
  points: number
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// Discord verification would require a bot - use honor system for now
async function verifyDiscordMembership(discordUserId: string): Promise<boolean> {
  // NOTE: Discord bot membership checks are not implemented; honor-system path returns true.
  void discordUserId
  return true
}

// Telegram verification would require a bot - use honor system for now
async function verifyTelegramMembership(telegramUserId: string): Promise<boolean> {
  const userId = typeof telegramUserId === 'string' ? telegramUserId.trim() : ''
  if (!/^\d+$/.test(userId)) return false

  const botToken = typeof process.env.TELEGRAM_BOT_TOKEN === 'string' ? process.env.TELEGRAM_BOT_TOKEN.trim() : ''
  const chatIdRaw =
    typeof process.env.TELEGRAM_WAITLIST_VERIFY_CHAT_ID === 'string'
      ? process.env.TELEGRAM_WAITLIST_VERIFY_CHAT_ID.trim()
      : typeof process.env.TELEGRAM_TARGET_CHAT_ID === 'string'
        ? process.env.TELEGRAM_TARGET_CHAT_ID.trim()
        : ''

  // Preserve current behavior for environments that haven't configured Telegram verification yet.
  if (!botToken || !chatIdRaw) {
    console.warn('Telegram verification not configured, using honor system')
    return true
  }

  try {
    const endpoint = `https://api.telegram.org/bot${botToken}/getChatMember`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatIdRaw,
        user_id: userId,
      }),
    })
    if (!response.ok) {
      console.error('Telegram membership verification API error:', response.status)
      return false
    }
    const payload = (await response.json()) as any
    const status = typeof payload?.result?.status === 'string' ? payload.result.status.trim().toLowerCase() : ''
    return status === 'member' || status === 'administrator' || status === 'creator'
  } catch (error) {
    console.error('Telegram membership verification failed:', error)
    return false
  }
}

const PLATFORM_POINTS: Record<SocialPlatform, number> = {
  discord: WAITLIST_POINTS.discord,
  telegram: WAITLIST_POINTS.telegram,
}

const PLATFORM_SOURCE: Record<SocialPlatform, string> = {
  discord: 'social_discord',
  telegram: 'social_telegram',
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 10 verifications per minute per IP
  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('verify-social', clientIp), { windowMs: 60_000, maxRequests: 10 })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const platform = body?.platform as SocialPlatform
  if (!platform || !['discord', 'telegram'].includes(platform)) {
    return res.status(400).json({ success: false, error: 'Invalid platform' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  
  await ensureWaitlistSchema(db as any)

  // Find the signup
  const me = await db.sql`
    SELECT id, primary_wallet, embedded_wallet, csw_address
    FROM profiles
    WHERE email = ${email}
    LIMIT 1;
  `
  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  
  if (!signupId) {
    return res.status(404).json({ success: false, error: 'Waitlist entry not found' } satisfies ApiEnvelope<never>)
  }

  const authorized = await isAuthorizedWalletForProfile({
    db: db as any,
    profileId: signupId,
    address: principalAddress,
  })
  if (!authorized) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this profile' } satisfies ApiEnvelope<never>)
  }

  let verified = false

  switch (platform) {
    case 'discord': {
      const discordUserId = typeof body?.discordUserId === 'string' ? body.discordUserId : ''
      verified = await verifyDiscordMembership(discordUserId)
      break
    }
    case 'telegram': {
      const telegramUserId = typeof body?.telegramUserId === 'string' ? body.telegramUserId : ''
      verified = await verifyTelegramMembership(telegramUserId)
      break
    }
  }

  let awarded = false
  if (verified) {
    // Award points (idempotent via ledger unique key)
    await awardWaitlistPoints({
      db,
      signupId,
      source: PLATFORM_SOURCE[platform],
      sourceId: platform,
      amount: PLATFORM_POINTS[platform],
    })
    awarded = true
  }

  const data: VerifySocialResponse = {
    email,
    platform,
    verified,
    awarded,
    points: verified ? PLATFORM_POINTS[platform] : 0,
  }
  
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<VerifySocialResponse>)
}
