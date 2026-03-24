import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const waitlistRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  '': () => import('./_waitlist.js'),
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

export async function getWaitlistApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = waitlistRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
