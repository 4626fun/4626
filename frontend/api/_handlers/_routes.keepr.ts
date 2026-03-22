import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const keeprRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'join': () => import('./keepr/_join.js'),
  'joinStatus': () => import('./keepr/_joinStatus.js'),
  'nonce': () => import('./keepr/_nonce.js'),
  'vault/automation': () => import('./keepr/vault/_automation.js'),
  'vault/upsert': () => import('./keepr/vault/_upsert.js'),
  'actions/enqueue': () => import('./keepr/actions/_enqueue.js'),
  'actions/pending': () => import('./keepr/actions/_pending.js'),
  'actions/updateStatus': () => import('./keepr/actions/_updateStatus.js'),
}

export async function getKeeprApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = keeprRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
