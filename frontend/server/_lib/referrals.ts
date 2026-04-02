import { createHmac } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let referralsSchemaEnsured = false
let referralsSchemaEnsurePromise: Promise<void> | null = null

export function normalizeReferralCode(input: string): string {
  const raw = String(input || '')
    .trim()
    .toUpperCase()
  // Keep it URL-safe and readable: A-Z0-9 only.
  // (Many coin symbols include unicode like "■" which we strip.)
  const cleaned = raw.replace(/[^A-Z0-9]/g, '')
  // Keep short (helps sharing and reduces typo rate).
  return cleaned.slice(0, 16)
}

export function referralCodeFromEmail(email: string | null | undefined): string | null {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail.includes('@')) return null
  const localPart = normalizedEmail.split('@')[0] ?? ''
  const code = normalizeReferralCode(localPart)
  return code.length > 0 ? code : null
}

export function dedupeReferralCodeCandidates(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeReferralCode(String(value ?? ''))
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

export function getClientIp(req: { headers?: Record<string, any> }): string {
  const h = req?.headers ?? {}
  const xf = h['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    // x-forwarded-for can be a list: client, proxy1, proxy2
    return xf.split(',')[0]?.trim() || ''
  }
  if (Array.isArray(xf) && xf.length > 0) {
    const first = String(xf[0] ?? '').trim()
    if (first) return first
  }
  return ''
}

export function getUserAgent(req: { headers?: Record<string, any> }): string {
  const ua = req?.headers?.['user-agent']
  return typeof ua === 'string' ? ua : Array.isArray(ua) ? String(ua[0] ?? '') : ''
}

export function hashForAttribution(value: string): string | null {
  const secret = (process.env.REFERRAL_HASH_SECRET || '').trim()
  if (!secret) return null
  const v = String(value || '').trim()
  if (!v) return null
  return createHmac('sha256', secret).update(v).digest('hex')
}

export async function ensureReferralsSchema(db: Db): Promise<void> {
  if (referralsSchemaEnsured) return
  if (referralsSchemaEnsurePromise) return referralsSchemaEnsurePromise
  referralsSchemaEnsurePromise = (async () => {
    try {
      const preflight = await db.sql`
        SELECT
          to_regclass('public.referral_clicks') IS NOT NULL AS has_referral_clicks,
          to_regclass('public.referral_conversions') IS NOT NULL AS has_referral_conversions,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'referral_code'
          ) AS has_profiles_referral_code,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'referred_by_signup_id'
          ) AS has_profiles_referred_by_signup_id;
      `
      const status = preflight.rows?.[0] ?? {}
      if (
        Boolean(status.has_referral_clicks) &&
        Boolean(status.has_referral_conversions) &&
        Boolean(status.has_profiles_referral_code) &&
        Boolean(status.has_profiles_referred_by_signup_id)
      ) {
        referralsSchemaEnsured = true
        return
      }
      const missing: string[] = []
      if (!Boolean(status.has_referral_clicks)) missing.push('public.referral_clicks')
      if (!Boolean(status.has_referral_conversions)) missing.push('public.referral_conversions')
      if (!Boolean(status.has_profiles_referral_code)) missing.push('public.profiles.referral_code')
      if (!Boolean(status.has_profiles_referred_by_signup_id)) missing.push('public.profiles.referred_by_signup_id')
      throw new Error(`referrals_schema_migration_required:${missing.join(',')}`)

    } catch (err) {
      referralsSchemaEnsured = false
      throw err
    } finally {
      referralsSchemaEnsurePromise = null
    }
  })()
  return referralsSchemaEnsurePromise
}
