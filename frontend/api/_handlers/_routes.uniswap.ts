import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

export const uniswapRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'query': () => import('./uniswap/_query.js'),
  'poolHistory': () => import('./uniswap/_poolHistory.js'),
  'quote': () => import('./uniswap/_quote.js'),
  'swap': () => import('./uniswap/_swap.js'),
  'order': () => import('./uniswap/_order.js'),
  'checkApproval': () => import('./uniswap/_checkApproval.js'),
  'checkDelegation': () => import('./uniswap/_checkDelegation.js'),
  'swap5792': () => import('./uniswap/_swap5792.js'),
  'swap7702': () => import('./uniswap/_swap7702.js'),
  'plan': () => import('./uniswap/_plan.js'),
  'liquidity': () => import('./uniswap/_liquidity.js'),
}

export async function getUniswapApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = uniswapRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
