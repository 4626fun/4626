import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const waitlistRouteLoaders: ApiRouteLoaders = {
  'airtable-sync': () => import('./waitlist/_airtableSync.js'),
  'bootstrap': () => import('./waitlist/_bootstrap.js'),
  'leaderboard': () => import('./waitlist/_leaderboard.js'),
  'lead': () => import('./waitlist/_lead.js'),
  'me': () => import('./waitlist/_me.js'),
  'position': () => import('./waitlist/_position.js'),
  'referrer': () => import('./waitlist/_referrer.js'),
  'stats': () => import('./waitlist/_stats.js'),
  'xmtp-join': () => import('./waitlist/_xmtpJoin.js'),
}

export function getWaitlistApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, waitlistRouteLoaders)
}
