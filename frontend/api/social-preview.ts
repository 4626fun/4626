import type { VercelRequest, VercelResponse } from '@vercel/node'

import socialPreviewHandler from './_handlers/social/_socialPreview.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return socialPreviewHandler(req, res)
}
