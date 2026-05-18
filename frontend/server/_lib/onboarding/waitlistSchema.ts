import { ensureReferralsSchema } from './referrals.js'
import { ensureWaitlistPointsSchema } from './waitlistPoints.js'
import { ensureCanonicalWalletsSchema } from '../wallet/canonicalWalletsSchema.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistSchemaEnsured = false
let waitlistSchemaEnsurePromise: Promise<void> | null = null

function isDeployDryRunContext(): boolean {
  if (String(process.env.DEPLOY_DRY_RUN_PORT ?? '').trim()) return true
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').toLowerCase()
  return deploymentVersion.includes('dryrun')
}

function isLikelyDbConnectivityFailure(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase()
  const code = String((error as any)?.code ?? '').trim().toUpperCase()
  return (
    code === '08006' ||
    code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('failed to connect to database') ||
    message.includes('authentication did not complete') ||
    message.includes('unable to check out connection from the pool')
  )
}

export async function ensureWaitlistSchema(db: Db): Promise<void> {
  if (waitlistSchemaEnsured) return
  if (waitlistSchemaEnsurePromise) return waitlistSchemaEnsurePromise
  waitlistSchemaEnsurePromise = (async () => {
    try {
      const preflight = await db.sql`
        SELECT
          to_regclass('public.profiles') IS NOT NULL AS has_profiles,
          to_regclass('public.referral_clicks') IS NOT NULL AS has_referral_clicks,
          to_regclass('public.referral_conversions') IS NOT NULL AS has_referral_conversions,
          to_regclass('public.points') IS NOT NULL AS has_points,
          to_regclass('public.wallets') IS NOT NULL AS has_wallets,
          to_regclass('public.profile_wallets') IS NOT NULL AS has_profile_wallets,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'app_access_status'
          ) AS has_app_access_status,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'verifications'
          ) AS has_verifications,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'profile_completed_at'
          ) AS has_profile_completed_at,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'primary_smart_wallet'
          ) AS has_primary_smart_wallet,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'primary_embedded_eoa'
          ) AS has_primary_embedded_eoa;
      `
      const status = preflight.rows?.[0] ?? {}
      if (
        Boolean(status.has_profiles) &&
        Boolean(status.has_referral_clicks) &&
        Boolean(status.has_referral_conversions) &&
        Boolean(status.has_points) &&
        Boolean(status.has_wallets) &&
        Boolean(status.has_profile_wallets) &&
        Boolean(status.has_app_access_status) &&
        Boolean(status.has_verifications) &&
        Boolean(status.has_profile_completed_at) &&
        Boolean(status.has_primary_smart_wallet) &&
        Boolean(status.has_primary_embedded_eoa)
      ) {
        await ensureReferralsSchema(db)
        await ensureWaitlistPointsSchema(db)
        await ensureCanonicalWalletsSchema(db)
        waitlistSchemaEnsured = true
        return
      }
      const missing: string[] = []
      if (!Boolean(status.has_profiles)) missing.push('public.profiles')
      if (!Boolean(status.has_referral_clicks)) missing.push('public.referral_clicks')
      if (!Boolean(status.has_referral_conversions)) missing.push('public.referral_conversions')
      if (!Boolean(status.has_points)) missing.push('public.points')
      if (!Boolean(status.has_wallets)) missing.push('public.wallets')
      if (!Boolean(status.has_profile_wallets)) missing.push('public.profile_wallets')
      if (!Boolean(status.has_app_access_status)) missing.push('public.profiles.app_access_status')
      if (!Boolean(status.has_verifications)) missing.push('public.profiles.verifications')
      if (!Boolean(status.has_profile_completed_at)) missing.push('public.profiles.profile_completed_at')
      if (!Boolean(status.has_primary_smart_wallet)) missing.push('public.profiles.primary_smart_wallet')
      if (!Boolean(status.has_primary_embedded_eoa)) missing.push('public.profiles.primary_embedded_eoa')
      throw new Error(`waitlist_schema_migration_required:${missing.join(',')}`)
    } catch (error) {
      waitlistSchemaEnsured = false
      if (
        error instanceof Error &&
        /_schema_migration_required:/.test(error.message)
      ) {
        throw error
      }
      if (isDeployDryRunContext() && isLikelyDbConnectivityFailure(error)) {
        // Dry-run must be able to proceed without a live DB.
        return
      }
      throw new Error('waitlist_schema_ensure_failed')
    } finally {
      waitlistSchemaEnsurePromise = null
    }
  })()
  return waitlistSchemaEnsurePromise
}
