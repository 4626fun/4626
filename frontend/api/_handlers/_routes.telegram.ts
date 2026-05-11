import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const telegramRouteLoaders: ApiRouteLoaders = {
  'bot-config': () => import('./telegram/_bot-config.js'),
  'link/complete': () => import('./telegram/_link-complete.js'),
  'link/ready': () => import('./telegram/_link-ready.js'),
  'link/telemetry': () => import('./telegram/_link-telemetry.js'),
  'miniapp/status': () => import('./telegram/_miniapp-status.js'),
  'miniapp/session': () => import('./telegram/_miniapp-session.js'),
  'metrics': () => import('./telegram/_metrics.js'),
  'portfolio': () => import('./telegram/_portfolio.js'),
  'holder-recheck': () => import('./telegram/_holder-recheck.js'),
  'unlink': () => import('./telegram/_unlink.js'),
}

export function getTelegramApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, telegramRouteLoaders)
}
