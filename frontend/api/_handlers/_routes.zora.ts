import type { VercelRequest, VercelResponse } from '@vercel/node'
import { zoraCliRouteSubpaths } from './zora/cli/_routes.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

export const zoraRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'coin': () => import('./zora/_coin.js'),
  [zoraCliRouteSubpaths.authStatus]: () => import('./zora/cli/_authStatus.js'),
  [zoraCliRouteSubpaths.explore]: () => import('./zora/cli/_explore.js'),
  [zoraCliRouteSubpaths.get]: () => import('./zora/cli/_get.js'),
  [zoraCliRouteSubpaths.priceHistory]: () => import('./zora/cli/_priceHistory.js'),
  [zoraCliRouteSubpaths.profile]: () => import('./zora/cli/_profile.js'),
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
