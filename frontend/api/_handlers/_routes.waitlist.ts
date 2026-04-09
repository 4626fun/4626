import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const waitlistRouteLoaders: ApiRouteLoaders = {
  'join': () => import('./waitlist/_join.js'),
  'bootstrap': () => import('./waitlist/_bootstrap.js'),
  'csw-link': () => import('./waitlist/_csw-link.js'),
  'csw-proof': () => import('./waitlist/_csw-proof.js'),
  'ledger': () => import('./waitlist/_ledger.js'),
  'leaderboard': () => import('./waitlist/_leaderboard.js'),
  'agent-points-sync': () => import('./waitlist/_agent-points-sync.js'),
  'lens-points-sync': () => import('./waitlist/_lens-points-sync.js'),
  'me': () => import('./waitlist/_me.js'),
  'position': () => import('./waitlist/_position.js'),
  'preprovision': () => import('./waitlist/_preprovision.js'),
  'profile-complete': () => import('./waitlist/_profile-complete.js'),
  'task-claim': () => import('./waitlist/_task-claim.js'),
  'update-email': () => import('./waitlist/_update-email.js'),
  'verify-social': () => import('./waitlist/_verify-social.js'),
  'verify-x': () => import('./waitlist/_verify-x.js'),
}

export function getWaitlistApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, waitlistRouteLoaders)
}
