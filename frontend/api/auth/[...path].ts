import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getAuthApiHandler } from '../_handlers/_routes.auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/auth/', '/__api/auth/'],
    resolveHandler: getAuthApiHandler,
    routeLabel: 'api/auth',
  })
}
