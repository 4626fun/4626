import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleRobots } from './_handlers/seo/_seo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleRobots(req, res)
}
