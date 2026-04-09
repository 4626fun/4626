import type { VercelRequest, VercelResponse } from '@vercel/node'

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

export type ApiHandlerModule = { default?: ApiHandler }

export type ApiRouteLoaders = Record<string, () => Promise<ApiHandlerModule>>

export async function loadHandlerFromMap(subpath: string, loaders: ApiRouteLoaders): Promise<ApiHandler | null> {
  const loader = loaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
