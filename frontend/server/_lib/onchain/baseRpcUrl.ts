const DEFAULT_BASE_RPC = 'https://mainnet.base.org'

/** Public fallbacks safe for Vercel/Railway server-side reads (no browser CF challenges). */
const DEFAULT_BASE_RPCS = [
  DEFAULT_BASE_RPC,
  'https://base-mainnet.public.blastapi.io',
] as const

/** LlamaRPC and similar endpoints often return Cloudflare challenges to datacenter IPs. */
export function isServerBlockedRpcUrl(rpcUrl: string): boolean {
  try {
    const host = new URL(rpcUrl.trim()).hostname.toLowerCase()
    return host === 'llamarpc.com' || host.endsWith('.llamarpc.com')
  } catch {
    return false
  }
}

function filterServerRpcUrls(urls: readonly string[]): string[] {
  return urls.filter((url) => !isServerBlockedRpcUrl(url))
}

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
  const configured = filterServerRpcUrls(
    splitConfiguredBaseRpcUrls().filter((url) => allowLocalFork || !isLocalForkRpcUrl(url)),
  )
  return Array.from(new Set([...configured, ...filterServerRpcUrls(DEFAULT_BASE_RPCS)]))
}

/** Short, log-safe RPC failure summary (avoids dumping Cloudflare HTML bodies). */
export function summarizeRpcFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (
    message.includes('Just a moment')
    || message.includes('cf-mitigated')
    || /Status:\s*403/.test(message)
  ) {
    return 'RPC access denied (Cloudflare-protected endpoint from server IP)'
  }
  return message.length > 240 ? `${message.slice(0, 237)}…` : message
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
