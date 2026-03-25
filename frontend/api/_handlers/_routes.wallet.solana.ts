import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

export const walletSolanaRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'setCanonical': () => import('./wallet/solana/_setCanonical.js'),
  'sweep/enqueue': () => import('./wallet/solana/sweep/_enqueue.js'),
  'sweep/process': () => import('./wallet/solana/sweep/_process.js'),
}

export async function getWalletSolanaApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = walletSolanaRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
