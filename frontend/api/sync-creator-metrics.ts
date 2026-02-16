import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from './_handlers/_sync-creator-metrics.js'

export default async function syncCreatorMetrics(req: VercelRequest, res: VercelResponse) {
  return handler(req, res)
}
