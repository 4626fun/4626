import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getDeployApiHandler } from '../_handlers/_routes.deploy.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/deploy/', '/__api/deploy/'],
    resolveHandler: getDeployApiHandler,
    routeLabel: 'api/deploy',
  })
}
