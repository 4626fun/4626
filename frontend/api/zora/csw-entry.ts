import type { VercelRequest, VercelResponse } from '@vercel/node'

import cswEntryHandler from '../_handlers/zora/_cswEntry.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return cswEntryHandler(req, res)
}
