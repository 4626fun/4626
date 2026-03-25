import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../../_lib/dispatchCatchAll.js'
import { getWalletSolanaApiHandler } from '../../_handlers/_routes.wallet.solana.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/wallet/solana/', '/__api/wallet/solana/'],
    resolveHandler: getWalletSolanaApiHandler,
    routeLabel: 'api/wallet/solana',
  })
}
