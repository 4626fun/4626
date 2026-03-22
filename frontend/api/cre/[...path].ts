import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getCreApiHandler } from '../_handlers/_routes.cre.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/cre/', '/__api/cre/'],
    resolveHandler: getCreApiHandler,
    routeLabel: 'api/cre',
  })
}
