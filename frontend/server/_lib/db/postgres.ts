declare const process: { env: Record<string, string | undefined> }

function isProbablyPostgresUrl(value: string | null | undefined): boolean {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return false
  return /^postgres(ql)?:\/\//i.test(v)
}

function isSupabaseDatabaseUrl(value: string | null | undefined): boolean {
  if (!isProbablyPostgresUrl(value)) return false
  try {
    const u = new URL(String(value))
    const host = u.hostname.toLowerCase()
    return host.includes('supabase.') || host.includes('pooler.supabase.com')
  } catch {
    return false
  }
}

type DbSource = 'vercel_postgres' | 'database_url'

function getDbConfig(): { source: DbSource; connectionString: string } | null {
  const fromDatabaseUrl = process.env.DATABASE_URL
  const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY)
  const preferDatabaseUrl = isSupabaseDatabaseUrl(fromDatabaseUrl) && hasSupabaseEnv
  // In production on Vercel, do NOT read DATABASE_URL by default.
  // - Many projects set DATABASE_URL for external providers (e.g. Supabase) that are incompatible with @vercel/postgres.
  // - Vercel Postgres sets POSTGRES_URL / POSTGRES_URL_NON_POOLING automatically.
  // Exception: if DATABASE_URL looks like Supabase and Supabase envs are set, prefer it.
  const isVercel = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  const fromVercelPool = process.env.POSTGRES_URL
  if (preferDatabaseUrl && isProbablyPostgresUrl(fromDatabaseUrl)) {
    return { source: 'database_url', connectionString: (fromDatabaseUrl ?? '').trim() }
  }
  if (isProbablyPostgresUrl(fromVercelPool)) return { source: 'vercel_postgres', connectionString: (fromVercelPool ?? '').trim() }

  const fromVercelDirect = process.env.POSTGRES_URL_NON_POOLING
  if (isProbablyPostgresUrl(fromVercelDirect)) return { source: 'vercel_postgres', connectionString: (fromVercelDirect ?? '').trim() }

  // Fallback: if Vercel Postgres is not configured, accept DATABASE_URL even on Vercel.
  // This enables running against external Postgres providers (e.g. Supabase) without requiring POSTGRES_URL.
  // Only accept actual Postgres connection strings; it's common for other providers to set DATABASE_URL.
  if (isProbablyPostgresUrl(fromDatabaseUrl)) return { source: 'database_url', connectionString: (fromDatabaseUrl ?? '').trim() }

  return null
}

function withRequiredSsl(connectionString: string): string {
  const cs = (connectionString ?? '').trim()
  if (!cs) return cs
  const lower = cs.toLowerCase()
  if (lower.includes('sslmode=')) return cs
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return cs
  return `${cs}${cs.includes('?') ? '&' : '?'}sslmode=require`
}

function requiresSsl(connectionString: string): boolean {
  const cs = (connectionString ?? '').trim().toLowerCase()
  if (!cs) return false
  if (cs.includes('localhost') || cs.includes('127.0.0.1')) return false
  // If explicitly disabled, respect it (useful for local tunnels / unusual setups).
  if (cs.includes('sslmode=disable')) return false
  return true
}

function parseEnvBool(value: string | undefined): boolean | undefined {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return undefined
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return undefined
}

function getSslMode(connectionString: string): string | null {
  try {
    const u = new URL(connectionString)
    const mode = (u.searchParams.get('sslmode') ?? '').trim().toLowerCase()
    return mode || null
  } catch {
    return null
  }
}

function getPgSslModeFromEnv(): string | null {
  const mode = String(process.env.PGSSLMODE ?? '')
    .trim()
    .toLowerCase()
  return mode || null
}

function stripQueryParams(connectionString: string, keys: string[]): string {
  try {
    const u = new URL(connectionString)
    for (const k of keys) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return connectionString
  }
}

function sslOptionsForConnection(connectionString: string): any | undefined {
  if (!requiresSsl(connectionString)) return undefined
  // Secure by default: require valid TLS certificates for remote Postgres.
  // Operators may explicitly relax this via POSTGRES_SSL_REJECT_UNAUTHORIZED=false.
  const envOverride = parseEnvBool(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED)
  if (envOverride !== undefined) return { rejectUnauthorized: envOverride }

  // Respect PGSSLMODE env when present (common provider guidance), then URL sslmode.
  // We intentionally ignore `no-verify` here to avoid implicit insecure transport.
  // If operators need relaxed TLS for a trusted environment, they must set
  // POSTGRES_SSL_REJECT_UNAUTHORIZED=false explicitly.
  const mode = getPgSslModeFromEnv() ?? getSslMode(connectionString)
  if (mode === 'no-verify') {
    console.warn(
      '[postgres] Ignoring PGSSLMODE=no-verify; set POSTGRES_SSL_REJECT_UNAUTHORIZED=false explicitly to relax TLS validation.',
    )
  }
  if (mode === 'disable') return undefined
  return { rejectUnauthorized: true }
}

function isSelfSignedCertChainError(err: unknown): boolean {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  if (code === 'SELF_SIGNED_CERT_IN_CHAIN') return true
  const message = String((err as any)?.message ?? err ?? '').toLowerCase()
  return message.includes('self-signed certificate in certificate chain')
}

type DbResult<T = any> = { rows: T[]; rowCount?: number }
type DbPool = {
  sql: <T = any>(strings: TemplateStringsArray, ...values: any[]) => Promise<DbResult<T>>
  // Preferred: explicit query API (helps satisfy scanners and is unambiguous parameterization).
  query?: (text: string, params?: any[]) => Promise<DbResult>
}

export type { DbPool }

function buildClientDb(client: { query: (text: string, params?: any[]) => Promise<any> }): DbPool {
  return {
    sql: async (strings: TemplateStringsArray, ...values: any[]) => {
      let text = ''
      for (let i = 0; i < strings.length; i++) {
        text += strings[i]
        if (i < values.length) text += `$${i + 1}`
      }
      const res = await client.query(text, values)
      const rows = res.rows ?? []
      return {
        rows,
        rowCount: Number.isFinite(Number(res.rowCount)) ? Number(res.rowCount) : rows.length,
      }
    },
    query: async (text: string, params?: any[]) => {
      const res = await client.query(text, params)
      const rows = res.rows ?? []
      return {
        rows,
        rowCount: Number.isFinite(Number(res.rowCount)) ? Number(res.rowCount) : rows.length,
      }
    },
  }
}

export async function runInTransaction<T>(fn: (db: DbPool) => Promise<T>): Promise<T | null> {
  const db = await getDb()
  if (!db) return null
  const pool = cachedRawPool
  if (!pool || typeof pool.connect !== 'function') {
    return fn(db)
  }

  const client = await pool.connect()
  const txDb = buildClientDb(client)
  try {
    await client.query('BEGIN')
    const result = await fn(txDb)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

let cachedDb: DbPool | null = null
let cachedRawPool: any = null
let initError: string | null = null
let initPromise: Promise<DbPool | null> | null = null
let initErrorAtMs = 0
let initRetryWindowMs = 0
let lastInitErrorSignature = ''
let lastInitErrorLoggedAtMs = 0

function parsePositiveInt(value: string | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

function isSessionModeMaxClientsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const lc = msg.toLowerCase()
  return (
    lc.includes('maxclientsinsessionmode') ||
    (lc.includes('max clients reached') && lc.includes('session mode') && lc.includes('pool_size'))
  )
}

function isPoolAcquireTimeoutError(err: unknown): boolean {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  if (code === 'ETIMEDOUT') return true
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const lc = msg.toLowerCase()
  return lc.includes('timeout exceeded when trying to connect') || lc.includes('timeout acquiring a client')
}

function getInitRetryWindowMs(): number {
  return parsePositiveInt(process.env.POSTGRES_INIT_RETRY_MS) ?? 10_000
}

function getSessionSaturationRetryWindowMs(): number {
  return parsePositiveInt(process.env.POSTGRES_INIT_RETRY_MS_MAX_CLIENTS) ?? 60_000
}

function getAuthInitRetryWindowMs(): number {
  return parsePositiveInt(process.env.POSTGRES_INIT_RETRY_MS_AUTH) ?? 300_000
}

function isDeployDryRunContext(): boolean {
  if (String(process.env.DEPLOY_DRY_RUN_PORT ?? '').trim()) return true
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').toLowerCase()
  return deploymentVersion.includes('dryrun')
}

function isLikelyConnectivityTimeout(err: unknown): boolean {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  if (code === 'ETIMEDOUT') return true
  const message = String((err as any)?.message ?? err ?? '').toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('authentication did not complete') ||
    message.includes('failed to connect to database')
  )
}

function isDbAuthConfigError(err: unknown): boolean {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  if (code === '28P01' || code === '28000') return true
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase()
  return (
    msg.includes('tenant or user not found') ||
    msg.includes('password authentication failed') ||
    msg.includes('authentication failed') ||
    msg.includes('role') && msg.includes('does not exist') ||
    msg.includes('no pg_hba.conf entry')
  )
}

function shouldLogInitError(signature: string, throttleMs: number): boolean {
  const now = Date.now()
  if (!signature) return true
  if (signature !== lastInitErrorSignature) {
    lastInitErrorSignature = signature
    lastInitErrorLoggedAtMs = now
    return true
  }
  if (now - lastInitErrorLoggedAtMs >= throttleMs) {
    lastInitErrorLoggedAtMs = now
    return true
  }
  return false
}

function resetCachedPool(): void {
  cachedDb = null
  initPromise = null
  initError = null
  initRetryWindowMs = 0
  const raw = cachedRawPool
  cachedRawPool = null
  if (raw && typeof raw.end === 'function') {
    raw.end().catch(() => {})
  }
}

const QUERY_RETRY_BASE_MS = 250
let lastPoolAcquireTimeoutWarnAtMs = Number.NEGATIVE_INFINITY
const POOL_ACQUIRE_TIMEOUT_WARN_THROTTLE_MS = 5 * 60_000

function getQueryRetryCount(): number {
  return parsePositiveInt(process.env.POSTGRES_QUERY_RETRY_COUNT) ?? 2
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withSessionRetry<T>(
  fn: () => Promise<T>,
  dbRef: DbPool,
  maxRetries: number,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const sessionModeMaxClients = isSessionModeMaxClientsError(err)
      const poolAcquireTimeout = isPoolAcquireTimeoutError(err)
      if (!sessionModeMaxClients && !poolAcquireTimeout) throw err
      if (attempt < maxRetries) {
        const jitter = 0.5 + Math.random() * 0.5
        const delayMs = QUERY_RETRY_BASE_MS * Math.pow(2, attempt) * jitter
        const reason = sessionModeMaxClients ? 'MaxClientsInSessionMode' : 'pool acquire timeout'
        if (sessionModeMaxClients) {
          console.warn(
            `[postgres] ${reason} on query; retrying (${attempt + 1}/${maxRetries}) after ${Math.round(delayMs)}ms`,
          )
        } else {
          const now = Date.now()
          if (now - lastPoolAcquireTimeoutWarnAtMs >= POOL_ACQUIRE_TIMEOUT_WARN_THROTTLE_MS) {
            lastPoolAcquireTimeoutWarnAtMs = now
            console.info(
              `[postgres] ${reason} on query; retrying (${attempt + 1}/${maxRetries}) after ${Math.round(delayMs)}ms`,
            )
          }
        }
        await sleep(delayMs)
      }
    }
  }
  if (cachedDb === dbRef) resetCachedPool()
  throw lastErr
}

/**
 * Returns true if a Postgres connection string appears to be configured in env.
 * Note: this doesn't guarantee connectivity.
 */
export function isDbConfigured(): boolean {
  return Boolean(getDbConfig())
}

export function getDbInitError(): string | null {
  return initError
}

export async function getDb(): Promise<DbPool | null> {
  if (cachedDb) return cachedDb
  if (initError) {
    const retryAfterMs = initRetryWindowMs > 0 ? initRetryWindowMs : getInitRetryWindowMs()
    const elapsed = Date.now() - initErrorAtMs
    if (elapsed < retryAfterMs) return null
    // Treat init failures as transient in serverless; allow periodic re-init.
    initError = null
    initRetryWindowMs = 0
    initPromise = null
  }
  const cfg = getDbConfig()
  if (!cfg?.connectionString) return null

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Re-read env at init time (still deterministic in serverless).
        const cfg2 = getDbConfig()
        const cs = cfg2?.connectionString
          ? withRequiredSsl(cfg2.connectionString)
          : null
        if (!cfg2 || !cs) return null
        const ssl = sslOptionsForConnection(cs)

        // Vercel Postgres (Neon): use @vercel/postgres.
        if (cfg2.source === 'vercel_postgres') {
          const mod: any = await import('@vercel/postgres')
          const createPool: any = mod?.createPool
          const createClient: any = mod?.createClient
          if (typeof createPool !== 'function' && typeof createClient !== 'function') {
            initError = 'Missing createPool/createClient exports from @vercel/postgres'
            return null
          }

          // Prefer pooled connections when possible (recommended for serverless),
          // but fall back to a direct client if the provided connection string is direct-only.
          try {
            if (typeof createPool === 'function') {
              const pool = createPool({ connectionString: cs, ssl })
              // Some drivers only surface "invalid_connection_string" on first query.
              // If this happens, fall back to createClient() below.
              try {
                await pool.sql`SELECT 1;`
                cachedDb = pool
                return cachedDb
              } catch (e: any) {
                const msg = e?.message ? String(e.message) : ''
                const isDirectOnly =
                  msg.toLowerCase().includes('invalid_connection_string') && msg.toLowerCase().includes('direct connection')
                if (!isDirectOnly) throw e
                console.warn('Pool connection string appears to be direct-only; falling back to createClient')
              }
            }
          } catch (e: any) {
            const msg = e?.message ? String(e.message) : ''
            // fall through to createClient
            console.warn('createPool failed, trying createClient', msg)
          }

          if (typeof createClient !== 'function') {
            initError = 'createPool failed and createClient is unavailable'
            return null
          }

          const client = createClient({ connectionString: cs, ssl })
          try {
            if (typeof client?.connect === 'function') await client.connect()
          } catch {
            // ignore connect errors here; first query will surface it.
          }

          cachedDb = client
          return cachedDb
        }

        // External Postgres (e.g. Supabase): use node-postgres (pg), not @vercel/postgres.
        const pg: any = await import('pg')
        const Pool: any = pg?.Pool
        if (typeof Pool !== 'function') {
          initError = 'Missing Pool export from pg'
          return null
        }
        // pg uses pg-connection-string internally when `connectionString` is set. If the URL contains
        // `sslmode=require|prefer|verify-ca`, newer versions warn and may apply stricter (non-libpq)
        // semantics (treating them as verify-full). That can break local/dev environments (and
        // any setup that uses a self-signed chain).
        //
        // We strip sslmode from the URL and rely on the explicit `ssl` option instead, which is
        // consistent and controlled via POSTGRES_SSL_REJECT_UNAUTHORIZED.
        const poolConnectionString = stripQueryParams(cs, ['sslmode', 'ssl', 'sslrootcert'])
        const isVercelRuntime = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
        const isSupabaseTarget = isSupabaseDatabaseUrl(poolConnectionString)
        const useConservativeServerlessPool = isVercelRuntime || isSupabaseTarget
        // In serverless, keep client count very small per instance to avoid
        // Supabase Session mode `MaxClientsInSessionMode` saturation.
        const max = parsePositiveInt(process.env.POSTGRES_POOL_MAX) ?? (useConservativeServerlessPool ? 1 : 10)
        // Keep idle connections short-lived on serverless / Supabase so each lambda
        // releases scarce session-mode clients quickly.
        const idleTimeoutMillis = parsePositiveInt(process.env.POSTGRES_POOL_IDLE_TIMEOUT_MS) ?? (useConservativeServerlessPool ? 1_000 : 5_000)
        const connectionTimeoutMillis =
          parsePositiveInt(process.env.POSTGRES_POOL_CONNECT_TIMEOUT_MS) ??
          (useConservativeServerlessPool ? 10_000 : 8_000)
        const maxUses = parsePositiveInt(process.env.POSTGRES_POOL_MAX_USES) ?? 7_500
        const createPgDb = async (sslForPool: any): Promise<DbPool> => {
          const pool = new Pool({
            connectionString: poolConnectionString,
            ssl: sslForPool,
            max,
            idleTimeoutMillis,
            connectionTimeoutMillis,
            maxUses,
            allowExitOnIdle: true,
          })
          // node-postgres emits an `error` event on the pool when an idle/
          // connecting client errors out (e.g. TLS handshake timeout against
          // the Supabase pooler). Without a listener Node treats it as an
          // unhandled error and crashes the process — which is exactly what
          // takes down the hermit Railway service. Attach a handler that logs
          // the failure and lets the pool reconnect on the next query.
          if (typeof (pool as { on?: unknown }).on === 'function') {
            pool.on('error', (err: unknown) => {
              const message = err instanceof Error ? err.message : String(err)
              const code = String((err as any)?.code ?? '').trim() || undefined
              console.warn('[postgres] pool client error (background)', { code, message })
              // If the pool has been emitting failures for an idle client,
              // drop the cached pool so the next getDb() call rebuilds it.
              if (cachedRawPool === pool) {
                resetCachedPool()
              }
            })
          }
          cachedRawPool = pool
          const queryRetries = getQueryRetryCount()
          const db: DbPool = {
            sql: async (strings: TemplateStringsArray, ...values: any[]) => {
              let text = ''
              for (let i = 0; i < strings.length; i++) {
                text += strings[i]
                if (i < values.length) text += `$${i + 1}`
              }
              return withSessionRetry(
                async () => {
                  const res = await pool.query(text, values)
                  const rows = res.rows ?? []
                  return {
                    rows,
                    rowCount: Number.isFinite(Number(res.rowCount))
                      ? Number(res.rowCount)
                      : rows.length,
                  }
                },
                db,
                queryRetries,
              )
            },
            query: async (text: string, params?: any[]) => {
              return withSessionRetry(
                async () => {
                  const res = await pool.query(text, params)
                  const rows = res.rows ?? []
                  return {
                    rows,
                    rowCount: Number.isFinite(Number(res.rowCount))
                      ? Number(res.rowCount)
                      : rows.length,
                  }
                },
                db,
                queryRetries,
              )
            },
          }
          // Sanity check connectivity (retried via withSessionRetry above).
          await db.sql`SELECT 1;`
          return db
        }

        try {
          cachedDb = await createPgDb(ssl)
          return cachedDb
        } catch (pgInitError) {
          const rawPool = cachedRawPool
          cachedRawPool = null
          if (rawPool && typeof rawPool.end === 'function') {
            await rawPool.end().catch(() => {})
          }
          throw pgInitError
        }
      } catch (err) {
        const rawPool = cachedRawPool
        cachedRawPool = null
        if (rawPool && typeof rawPool.end === 'function') rawPool.end().catch(() => {})
        const authLike = isDbAuthConfigError(err)
        const sessionModeSaturated = isSessionModeMaxClientsError(err)
        const retryWindow =
          sessionModeSaturated
            ? getSessionSaturationRetryWindowMs()
            : authLike
              ? getAuthInitRetryWindowMs()
              : getInitRetryWindowMs()
        initRetryWindowMs = retryWindow
        const message = err instanceof Error ? err.message : String(err)
        const code = String((err as any)?.code ?? '').trim().toUpperCase()
        const signature = `${code}:${message}`

        if (sessionModeSaturated) {
          if (shouldLogInitError(signature, retryWindow)) {
            console.error(
              `Postgres pool saturated (session mode max clients reached); backing off retries for ${Math.round(
                retryWindow / 1000,
              )}s. Tune POSTGRES_POOL_MAX/POSTGRES_POOL_IDLE_TIMEOUT_MS or increase Supabase pool_size.`,
              err,
            )
          }
        } else if (authLike) {
          if (shouldLogInitError(signature, retryWindow)) {
            if (isDeployDryRunContext() && isLikelyConnectivityTimeout(err)) {
              console.info(
                `[postgres] dry-run DB auth/connectivity unavailable; continuing without DB for now (retry in ${Math.round(
                  retryWindow / 1000,
                )}s)`,
              )
            } else {
              console.error(
                `Postgres auth/config error; backing off retries for ${Math.round(retryWindow / 1000)}s`,
                {
                  code: code || undefined,
                  message,
                },
              )
            }
          }
        } else {
          if (
            isSelfSignedCertChainError(err) &&
            parseEnvBool(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED) === true
          ) {
            console.error(
              'Postgres TLS validation failed with SELF_SIGNED_CERT_IN_CHAIN while POSTGRES_SSL_REJECT_UNAUTHORIZED=true. ' +
                'Set POSTGRES_SSL_REJECT_UNAUTHORIZED=false for this provider chain.',
            )
          }
          if (shouldLogInitError(signature, retryWindow)) {
            if (isDeployDryRunContext() && isLikelyConnectivityTimeout(err)) {
              console.info(
                `[postgres] dry-run DB connectivity timeout; continuing without DB for now (retry in ${Math.round(
                  retryWindow / 1000,
                )}s)`,
              )
            } else {
              console.error('Failed to initialize Postgres pool', err)
            }
          }
        }
        initError = message || 'Failed to initialize Postgres pool'
        initErrorAtMs = Date.now()
        initPromise = null
        return null
      }
    })()
  }

  return await initPromise
}

let creatorAccessSchemaEnsured = false

export async function ensureCreatorAccessSchema(): Promise<void> {
  const db = await getDb()
  if (!db) return
  if (creatorAccessSchemaEnsured) return
  creatorAccessSchemaEnsured = true

  await db.sql`
    CREATE TABLE IF NOT EXISTS allowlist (
      address TEXT PRIMARY KEY,
      csw_address TEXT,
      approved_by TEXT,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      note TEXT
    );
  `

  try {
    // Remove historical duplicate index name.
    await db.sql`DROP INDEX IF EXISTS creator_allowlist_revoked_at_idx;`
  } catch {
    // ignore (already dropped or insufficient permissions)
  }
  
  // Add csw_address column if it doesn't exist (migration for existing tables)
  try {
    await db.sql`ALTER TABLE allowlist ADD COLUMN IF NOT EXISTS csw_address TEXT;`
  } catch {
    // Column may already exist
  }

  await db.sql`
    CREATE INDEX IF NOT EXISTS allowlist_address_active_lc_idx
      ON allowlist ((LOWER(address)))
      WHERE revoked_at IS NULL;
  `
  await db.sql`
    CREATE INDEX IF NOT EXISTS allowlist_csw_active_lc_idx
      ON allowlist ((LOWER(csw_address)))
      WHERE csw_address IS NOT NULL AND revoked_at IS NULL;
  `
  
  await db.sql`
    CREATE TABLE IF NOT EXISTS access_requests (
      id BIGSERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      coin_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT,
      decision_note TEXT
    );
  `

  // Keep it simple: don't create a postgres enum; enforce via a CHECK constraint.
  // If it already exists, Postgres will throw; that's fine.
  try {
    await db.sql`
      ALTER TABLE access_requests
        ADD CONSTRAINT access_requests_status_check
        CHECK (status IN ('pending', 'approved', 'denied'));
    `
  } catch {
    // ignore
  }

  await db.sql`CREATE INDEX IF NOT EXISTS access_requests_status_created_idx ON access_requests (status, created_at DESC);`
  await db.sql`
    CREATE INDEX IF NOT EXISTS access_requests_wallet_lc_created_idx
      ON access_requests ((LOWER(wallet_address)), created_at DESC);
  `
  try {
    // Remove historical duplicate index names.
    await db.sql`DROP INDEX IF EXISTS creator_access_requests_wallet_idx;`
  } catch {
    // ignore (already dropped or insufficient permissions)
  }

  // Prevent multiple concurrent pending requests per wallet.
  await db.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS access_requests_wallet_pending_unique
      ON access_requests (wallet_address)
      WHERE status = 'pending';
  `
  try {
    // Remove historical duplicate unique index name.
    await db.sql`DROP INDEX IF EXISTS creator_access_requests_wallet_pending_unique;`
  } catch {
    // ignore (already dropped or insufficient permissions)
  }
}
