import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const lensRouteLoaders: ApiRouteLoaders = {
  'share-token-metadata': () => import('./lens/_share-token-metadata.js'),
  'agent-registration': () => import('./lens/_agent-registration.js'),
  'reputation-graph': () => import('./lens/_reputation-graph.js'),
  'feedback-payload': () => import('./lens/_feedback-payload.js'),
}

export function getLensApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, lensRouteLoaders)
}
