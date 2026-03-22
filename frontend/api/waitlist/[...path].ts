import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getWaitlistApiHandler } from '../_handlers/_routes.waitlist.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/waitlist/', '/__api/waitlist/'],
    resolveHandler: getWaitlistApiHandler,
    routeLabel: 'api/waitlist',
  })
}
