import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'
import { zoraCliRouteSubpaths } from './zora/cli/_routes.js'

export const zoraRouteLoaders: ApiRouteLoaders = {
  'csw-entry': () => import('./zora/_cswEntry.js'),
  'csw-entry/challenge': () => import('./zora/_cswEntryChallenge.js'),
  'csw-entry/telegram-verify': () => import('./zora/_cswEntryTelegramVerify.js'),
  'coin': () => import('./zora/_coin.js'),
  'coinHistory': () => import('./zora/_coinHistory.js'),
  [zoraCliRouteSubpaths.authStatus]: () => import('./zora/cli/_authStatus.js'),
  [zoraCliRouteSubpaths.explore]: () => import('./zora/cli/_explore.js'),
  [zoraCliRouteSubpaths.get]: () => import('./zora/cli/_get.js'),
  [zoraCliRouteSubpaths.priceHistory]: () => import('./zora/cli/_priceHistory.js'),
  [zoraCliRouteSubpaths.profile]: () => import('./zora/cli/_profile.js'),
  'exploreSparklines': () => import('./zora/_exploreSparklines.js'),
  'explore': () => import('./zora/_explore.js'),
  'link/status': () => import('./zora/link/_status.js'),
  'metrics': () => import('./zora/_metrics.js'),
  'migratedCoins': () => import('./zora/_migratedCoins.js'),
  'refresh': () => import('./zora/_refresh.js'),
  'profile': () => import('./zora/_profile.js'),
  'profileCoins': () => import('./zora/_profileCoins.js'),
  'resolve': () => import('./zora/_resolve.js'),
  'trendStatus': () => import('./zora/_trendStatus.js'),
  'trendReserve': () => import('./zora/_trendReserve.js'),
  'trendSentinelProcess': () => import('./zora/_trendSentinelProcess.js'),
  'topCreators': () => import('./zora/_topCreators.js'),
}

export function getZoraApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, zoraRouteLoaders)
}
