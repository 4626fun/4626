import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getUniswapApiHandler } from '../_handlers/_routes.uniswap.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/uniswap/', '/__api/uniswap/'],
    resolveHandler: getUniswapApiHandler,
    routeLabel: 'api/uniswap',
  })
}
