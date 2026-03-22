import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getLensApiHandler } from '../_handlers/_routes.lens.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/lens/', '/__api/lens/'],
    resolveHandler: getLensApiHandler,
    routeLabel: 'api/lens',
  })
}
