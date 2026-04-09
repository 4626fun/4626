import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const deployRouteLoaders: ApiRouteLoaders = {
  'solanaInfraStatus': () => import('./deploy/_solanaInfraStatus.js'),
  'provisionSolanaRoute': () => import('./deploy/_provisionSolanaRoute.js'),
  'registerSolanaBridgeToken': () => import('./deploy/_registerSolanaBridgeToken.js'),
}

export function getDeployApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, deployRouteLoaders)
}
