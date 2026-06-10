/** Shared local-dev / deploy-dry-run env helpers for Vite + API handlers. */

export function isDeployDryRunContext(): boolean {
  if (String(process.env.DEPLOY_DRY_RUN_PORT ?? '').trim()) return true
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').toLowerCase()
  return deploymentVersion.includes('dryrun')
}

export function isDeployDryRunDbEnabled(): boolean {
  return String(process.env.DEPLOY_DRY_RUN_KEEP_DB_ENV ?? '0').trim() === '1'
}

/** Dry-run defaults skip Postgres unless DEPLOY_DRY_RUN_KEEP_DB_ENV=1. */
export function isDeployDryRunDbDisabled(): boolean {
  return isDeployDryRunContext() && !isDeployDryRunDbEnabled()
}

export function resolveLocalDryRunRpcUrl(): string | null {
  const raw = String(process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL ?? '').trim()
  if (!raw) return null
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(raw)) return null
  return raw
}

/** Apply deploy-dry-run env policy after Vite loads dotenv files from disk. */
export function applyDeployDryRunLocalDevEnv(): void {
  if (!isDeployDryRunContext()) return

  const localFork = resolveLocalDryRunRpcUrl()
  if (localFork) {
    process.env.BASE_READ_RPC_URL = localFork
    process.env.BASE_LOGS_RPC_URL = localFork
  }

  if (isDeployDryRunDbDisabled()) {
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    delete process.env.POSTGRES_URL_NON_POOLING
  }
}

/** Dev-server env normalization for local API handlers (Vite configureServer). */
export function applyLocalDevServerEnv(): void {
  if (process.env.NODE_ENV === 'development') {
    if (!String(process.env.ETH_RPC_URL ?? '').trim()) {
      process.env.ETH_RPC_URL = 'https://ethereum-rpc.publicnode.com'
    }
  }
  applyDeployDryRunLocalDevEnv()
}

/** Drop slow dev-only upstreams when faster URLs are already configured. */
export function filterDevelopmentRpcUrls(urls: string[]): string[] {
  if (process.env.NODE_ENV !== 'development') return urls
  const hasPreferred = urls.some((url) => !/matrixed\.link/i.test(url))
  if (!hasPreferred) return urls
  return urls.filter((url) => !/matrixed\.link/i.test(url))
}
