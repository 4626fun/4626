import type { VercelRequest, VercelResponse } from '@vercel/node'

import registerSolanaBridgeTokenHandler, {
  SOLANA_REGISTRATION_ROUTE_KIND_KEY,
} from './_registerSolanaBridgeToken.js'

/**
 * OVault-first alias for Solana mesh preparation.
 *
 * Keeps backward compatibility by delegating to the existing registration
 * implementation while callers migrate from compatibility route names.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ;(req as unknown as Record<string, unknown>)[SOLANA_REGISTRATION_ROUTE_KIND_KEY] = 'ovault'
  return registerSolanaBridgeTokenHandler(req, res)
}
