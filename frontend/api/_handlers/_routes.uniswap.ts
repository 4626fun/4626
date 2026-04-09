import type { ApiRouteLoaders } from './_routeLoader.js'
import { loadHandlerFromMap } from './_routeLoader.js'

export const uniswapRouteLoaders: ApiRouteLoaders = {
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

export function getUniswapApiHandler(subpath: string) {
  return loadHandlerFromMap(subpath, uniswapRouteLoaders)
}
