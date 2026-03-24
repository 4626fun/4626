import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

const deployRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'solanaInfraStatus': () => import('./deploy/_solanaInfraStatus.js'),
  'provisionSolanaRoute': () => import('./deploy/_provisionSolanaRoute.js'),
  'registerSolanaBridgeToken': () => import('./deploy/_registerSolanaBridgeToken.js'),
}

export async function getDeployApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = deployRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
