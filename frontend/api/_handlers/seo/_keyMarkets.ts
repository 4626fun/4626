import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleKeyMarketsHtml } from './_keyMarketsHtml.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleKeyMarketsHtml(req, res)
}
