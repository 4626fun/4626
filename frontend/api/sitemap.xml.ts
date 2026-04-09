import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleSitemap } from './_handlers/_seo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleSitemap(req, res)
}
