import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const walletSolanaRouteLoaders: ApiRouteLoaders = {
  'setCanonical': () => import('./wallet/solana/_setCanonical.js'),
  'sweep/enqueue': () => import('./wallet/solana/sweep/_enqueue.js'),
  'sweep/process': () => import('./wallet/solana/sweep/_process.js'),
}

export function getWalletSolanaApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, walletSolanaRouteLoaders)
}
