import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../_lib/dispatchCatchAll.js'
import { getTelegramApiHandler } from '../_handlers/_routes.telegram.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/telegram/', '/__api/telegram/'],
    resolveHandler: getTelegramApiHandler,
    routeLabel: 'api/telegram',
  })
}
