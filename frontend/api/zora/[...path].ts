import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getZoraApiHandler } from '../_handlers/_routes.zora.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/zora/', '/__api/zora/'],
    resolveHandler: getZoraApiHandler,
    routeLabel: 'api/zora',
  })
}
