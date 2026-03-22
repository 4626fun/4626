import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from './_lib/dispatchCatchAll.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { getApiHandler } = await import('./_handlers/_routes.js')
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/', '/__api/'],
    resolveHandler: getApiHandler,
    routeLabel: 'api',
    jsonRpcCompatSubpath: 'paymaster',
  })
}
