import type { VercelRequest, VercelResponse } from '@vercel/node'

import cswEntryChallengeHandler from '../../_handlers/zora/_cswEntryChallenge.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return cswEntryChallengeHandler(req, res)
}
