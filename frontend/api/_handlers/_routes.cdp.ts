import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const cdpRouteLoaders: ApiRouteLoaders = {
  'swap/price': () => import('./cdp/swap/_price.js'),
  'swap/execute': () => import('./cdp/swap/_execute.js'),
}

export function getCdpApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, cdpRouteLoaders)
}
