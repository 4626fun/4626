const DEFAULT_BASE_RPC = 'https://mainnet.base.org'

const DEFAULT_BASE_RPCS = [
  DEFAULT_BASE_RPC,
  'https://base.llamarpc.com',
  'https://base-mainnet.public.blastapi.io',
] as const

/** True when the URL targets a local Anvil/Hardhat fork (deploy dry-run only). */
export function isLocalForkRpcUrl(rpcUrl: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(rpcUrl.trim())
}

/** viem `http()` cannot speak WebSocket — coerce ws(s) env URLs to http(s). */
export function normalizeViemHttpRpcUrl(rpcUrl: string): string {
  const trimmed = rpcUrl.trim()
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice('wss://'.length)}`
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice('ws://'.length)}`
  return trimmed
}

function splitConfiguredBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => normalizeViemHttpRpcUrl(part.trim()))
    .filter(Boolean)
}

/**
 * Server-side Base RPC for live mainnet reads (owner-install preview, Relay simulation, etc.).
 * Local fork URLs are ignored unless explicitly allowed — deploy dry-run must not leak into
 * `/api/onboarding/preview-*` when Anvil is not running.
 */
export function resolveServerBaseRpcUrls(options?: { allowLocalFork?: boolean }): string[] {
  const allowLocalFork = options?.allowLocalFork === true
  const configured = splitConfiguredBaseRpcUrls().filter(
    (url) => allowLocalFork || !isLocalForkRpcUrl(url),
  )
  return Array.from(new Set([...configured, ...DEFAULT_BASE_RPCS]))
}

export function resolveServerBaseRpcUrl(options?: { allowLocalFork?: boolean }): string {
  return resolveServerBaseRpcUrls(options)[0] ?? DEFAULT_BASE_RPC
}

/**
 * Deploy session / dry-run RPC. Prefers `DEPLOY_DRY_RUN_LOCAL_RPC_URL`, then any
 * localhost entry in `BASE_RPC_URL`, otherwise live mainnet.
 */
export function resolveDeploySessionRpcUrl(): string {
  const dryRunLocal = (process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL ?? '').trim()
  if (dryRunLocal) return normalizeViemHttpRpcUrl(dryRunLocal)
  const localFork = splitConfiguredBaseRpcUrls().find((url) => isLocalForkRpcUrl(url))
  if (localFork) return localFork
  return resolveServerBaseRpcUrl()
}
