import type { VercelRequest, VercelResponse } from '@vercel/node'

import verifyHandler from '../../_handlers/zora/_cswEntryTelegramVerify.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return verifyHandler(req, res)
}
