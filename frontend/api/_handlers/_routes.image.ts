import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const imageRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'external': () => import('./image/_external-proxy.js'),
  'jobs/status': () => import('./image/_jobs-status.js'),
  'projects/assets/upload': () => import('./image/_assets-upload.js'),
  'projects/associate-vault': () => import('./image/_associate-vault.js'),
  'projects/auto-assets': () => import('./image/_auto-assets.js'),
  'projects/create': () => import('./image/_projects-create.js'),
  'projects/direct-compose': () => import('./image/_direct-compose.js'),
  'projects/generate': () => import('./image/_generate.js'),
  'projects/get': () => import('./image/_projects-get.js'),
  'projects/refine': () => import('./image/_refine.js'),
  'projects/vault-image': () => import('./image/_vault-image-get.js'),
}

export async function getImageApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = imageRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
