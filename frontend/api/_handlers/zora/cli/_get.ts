import type { VercelRequest } from '@vercel/node'

import { getStringQuery } from '../../../../server/zora/_shared.js'
import { getCliCoin } from '../../../../server/zora/cliCompat.js'
import { zoraCliRoutePaths } from './_routes.js'
import { okParams, parseError, withCliReadHandler } from './_shared.js'

export default withCliReadHandler({
  endpointPath: zoraCliRoutePaths.get,
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
    })
  },
  run({ params, serverKey }) {
    return getCliCoin({
      serverKey: serverKey!,
      ...params,
    })
  },
  fallbackSuggestion: 'Try an address, or type=creator-coin with a valid creator handle.',
})
