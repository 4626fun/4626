import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getImageApiHandler } from '../_handlers/_routes.image.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/image/', '/__api/image/'],
    resolveHandler: getImageApiHandler,
    routeLabel: 'api/image',
  })
}
