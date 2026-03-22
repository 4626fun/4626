import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getKeeprApiHandler } from '../_handlers/_routes.keepr.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/keepr/', '/__api/keepr/'],
    resolveHandler: getKeeprApiHandler,
    routeLabel: 'api/keepr',
  })
}
