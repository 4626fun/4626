import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const authRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
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

export async function getAuthApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = authRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
