import type { VercelRequest, VercelResponse } from '@vercel/node'

import registerSolanaBridgeTokenHandler from './_registerSolanaBridgeToken.js'

/**
 * Canonical Solana OVault mesh setup route.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return registerSolanaBridgeTokenHandler(req, res)
}
