import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const zoraRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'coin': () => import('./zora/_coin.js'),
  'explore': () => import('./zora/_explore.js'),
  'link/status': () => import('./zora/link/_status.js'),
  'metrics': () => import('./zora/_metrics.js'),
  'refresh': () => import('./zora/_refresh.js'),
  'profile': () => import('./zora/_profile.js'),
  'profileCoins': () => import('./zora/_profileCoins.js'),
  'resolve': () => import('./zora/_resolve.js'),
  'trendStatus': () => import('./zora/_trendStatus.js'),
  'trendReserve': () => import('./zora/_trendReserve.js'),
  'trendFunnelRun': () => import('./zora/_trendFunnelRun.js'),
  'trendMetrics': () => import('./zora/_trendMetrics.js'),
  'trendSentinelProcess': () => import('./zora/_trendSentinelProcess.js'),
  'topCreators': () => import('./zora/_topCreators.js'),
}

export async function getZoraApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = zoraRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
