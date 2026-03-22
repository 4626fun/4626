import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/v1/', '/__api/v1/'],
    resolveHandler: getV1ApiHandler,
    routeLabel: 'api/v1',
  })
}
