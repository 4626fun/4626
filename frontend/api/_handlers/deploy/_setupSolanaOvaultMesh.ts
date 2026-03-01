import type { VercelRequest, VercelResponse } from '@vercel/node'

import registerSolanaBridgeTokenHandler from './_registerSolanaBridgeToken.js'

/**
 * OVault-first alias for Solana mesh preparation.
 *
 * Keeps backward compatibility by delegating to the existing registration
 * implementation while callers migrate from legacy route names.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return registerSolanaBridgeTokenHandler(req, res)
}
