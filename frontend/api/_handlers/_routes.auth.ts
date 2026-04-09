import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const authRouteLoaders: ApiRouteLoaders = {
  'admin': () => import('./auth/_admin.js'),
  'agent-nonce': () => import('./auth/_agent-nonce.js'),
  'agent-verify': () => import('./auth/_agent-verify.js'),
  'handoff/create': () => import('./auth/_handoff-create.js'),
  'handoff/redeem': () => import('./auth/_handoff-redeem.js'),
  'logout': () => import('./auth/_logout.js'),
  'me': () => import('./auth/_me.js'),
  'nonce': () => import('./auth/_nonce.js'),
  'privy': () => import('./auth/_privy.js'),
  'verify': () => import('./auth/_verify.js'),
}

export function getAuthApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, authRouteLoaders)
}
