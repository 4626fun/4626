import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const keeprRouteLoaders: ApiRouteLoaders = {
  'join': () => import('./keepr/_join.js'),
  'joinStatus': () => import('./keepr/_joinStatus.js'),
  'nonce': () => import('./keepr/_nonce.js'),
  'vault/automation': () => import('./keepr/vault/_automation.js'),
  'vault/upsert': () => import('./keepr/vault/_upsert.js'),
  'actions/enqueue': () => import('./keepr/actions/_enqueue.js'),
  'actions/pending': () => import('./keepr/actions/_pending.js'),
  'actions/updateStatus': () => import('./keepr/actions/_updateStatus.js'),
}

export function getKeeprApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, keeprRouteLoaders)
}
