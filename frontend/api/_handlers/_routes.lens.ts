import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const lensRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'mapping': () => import('./lens/_mapping.js'),
  'graph': () => import('./lens/_graph.js'),
  'share-token-metadata': () => import('./lens/_share-token-metadata.js'),
  'agent-registration': () => import('./lens/_agent-registration.js'),
  'reputation-graph': () => import('./lens/_reputation-graph.js'),
  'feedback-payload': () => import('./lens/_feedback-payload.js'),
}

export async function getLensApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = lensRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
