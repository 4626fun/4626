import type { VercelRequest } from '@vercel/node'

import {
  getStringQuery,
} from '../../../../server/zora/_shared.js'
import { priceHistoryCli } from '../../../../server/zora/cliCompat.js'
import { zoraCliRoutePaths } from './_routes.js'
import { okParams, parseError, withCliReadHandler } from './_shared.js'

export default withCliReadHandler({
  endpointPath: zoraCliRoutePaths.priceHistory,
  cacheSeconds: 60,
  parse(req: VercelRequest) {
    const reference =
      getStringQuery(req, 'id') ?? getStringQuery(req, 'reference') ?? getStringQuery(req, 'coin')
    if (!reference) {
      return parseError(
        400,
        'Missing coin identifier.',
        'Provide id=<address|name> and optional type=<creator-coin|trend|post|all>.',
      )
    }

    return okParams({
      reference,
      coinType: getStringQuery(req, 'type') ?? getStringQuery(req, 'coinType'),
      interval: getStringQuery(req, 'interval'),
    })
  },
  run({ params, serverKey }) {
    return priceHistoryCli({
      serverKey: serverKey!,
      ...params,
    })
  },
  fallbackSuggestion: 'Use a valid coin reference and interval (1h, 24h, 1w, 1m, ALL).',
})
