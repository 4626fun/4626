type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let canonicalWalletsSchemaEnsured = false
let canonicalWalletsSchemaEnsurePromise: Promise<void> | null = null

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

async function assertNoDuplicatePrivyUserIds(db: Db): Promise<void> {
  const dupes = await db.sql`
    SELECT privy_user_id
    FROM profiles
    WHERE privy_user_id IS NOT NULL
    GROUP BY privy_user_id
    HAVING COUNT(*) > 1
    LIMIT 1;
  `
  if (Array.isArray(dupes.rows) && dupes.rows.length > 0) {
    throw new Error('duplicate_privy_user_id')
  }
}

export async function ensureCanonicalWalletsSchema(db: Db): Promise<void> {
  if (canonicalWalletsSchemaEnsured) return
  if (canonicalWalletsSchemaEnsurePromise) return canonicalWalletsSchemaEnsurePromise
  canonicalWalletsSchemaEnsurePromise = (async () => {
    try {
      const preflight = await db.sql`
        SELECT
          to_regclass('public.wallets') IS NOT NULL AS has_wallets,
          to_regclass('public.profile_wallets') IS NOT NULL AS has_profile_wallets,
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
          ) AS has_primary_embedded_eoa,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'canonical_solana_wallet'
          ) AS has_canonical_solana_wallet,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profile_wallets'
              AND column_name = 'is_canonical_solana_wallet'
          ) AS has_profile_wallets_canonical_solana,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profile_wallets'
              AND column_name = 'is_operational_solana_wallet'
          ) AS has_profile_wallets_operational_solana;
      `
      const status = preflight.rows?.[0] ?? {}
      if (
        Boolean(status.has_wallets) &&
        Boolean(status.has_profile_wallets) &&
        Boolean(status.has_primary_smart_wallet) &&
        Boolean(status.has_primary_embedded_eoa) &&
        Boolean(status.has_canonical_solana_wallet) &&
        Boolean(status.has_profile_wallets_canonical_solana) &&
        Boolean(status.has_profile_wallets_operational_solana)
      ) {
        await assertNoDuplicatePrivyUserIds(db)
        canonicalWalletsSchemaEnsured = true
        return
      }
      const missing: string[] = []
      if (!Boolean(status.has_wallets)) missing.push('public.wallets')
      if (!Boolean(status.has_profile_wallets)) missing.push('public.profile_wallets')
      if (!Boolean(status.has_primary_smart_wallet)) missing.push('public.profiles.primary_smart_wallet')
      if (!Boolean(status.has_primary_embedded_eoa)) missing.push('public.profiles.primary_embedded_eoa')
      if (!Boolean(status.has_canonical_solana_wallet)) missing.push('public.profiles.canonical_solana_wallet')
      if (!Boolean(status.has_profile_wallets_canonical_solana)) {
        missing.push('public.profile_wallets.is_canonical_solana_wallet')
      }
      if (!Boolean(status.has_profile_wallets_operational_solana)) {
        missing.push('public.profile_wallets.is_operational_solana_wallet')
      }
      throw new Error(`canonical_wallets_schema_migration_required:${missing.join(',')}`)
    } catch (error) {
      canonicalWalletsSchemaEnsured = false
      if (
        error instanceof Error &&
        error.message.startsWith('canonical_wallets_schema_migration_required:')
      ) {
        throw error
      }
      if (isDeployDryRunContext() && isLikelyDbConnectivityFailure(error)) {
        // Dry-run should remain usable even if DB-backed identity tables are unavailable.
        return
      }
      throw new Error('canonical_wallets_schema_ensure_failed')
    } finally {
      canonicalWalletsSchemaEnsurePromise = null
    }
  })()
  return canonicalWalletsSchemaEnsurePromise
}
