import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const creRouteLoaders: ApiRouteLoaders = {
  'vaults/active': () => import('./cre/vaults/_active.js'),
  'keeper/tend': () => import('./cre/keeper/_tend.js'),
  'keeper/report': () => import('./cre/keeper/_report.js'),
  'keeper/sweep': () => import('./cre/keeper/_sweep.js'),
  'keeper/mark-settled': () => import('./cre/keeper/_markSettled.js'),
  'keeper/alert': () => import('./cre/keeper/_alert.js'),
  'keeper/aiAssess': () => import('./cre/keeper/_aiAssess.js'),
  'keeper/solana/reconcile': () => import('./cre/keeper/_solanaReconcile.js'),
  'runtime/ingest': () => import('./cre/runtime/_ingest.js'),
  'runtime/decisions': () => import('./cre/runtime/_decisions.js'),
  'runtime/trigger': () => import('./cre/runtime/_trigger.js'),
}

export function getCreApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, creRouteLoaders)
}
