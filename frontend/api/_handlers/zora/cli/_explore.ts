import type { VercelRequest } from '@vercel/node'

import {
  getNumberQuery,
  getStringQuery,
} from '../../../../server/zora/_shared.js'
import { exploreCli } from '../../../../server/zora/cliCompat.js'
import { zoraCliRoutePaths } from './_routes.js'
import { okParams, withCliReadHandler } from './_shared.js'

export default withCliReadHandler({
  endpointPath: zoraCliRoutePaths.explore,
  cacheSeconds: 60,
  parse(req: VercelRequest) {
    return okParams({
      sort: getStringQuery(req, 'sort'),
      type: getStringQuery(req, 'type'),
      limit: getNumberQuery(req, 'limit') ?? getNumberQuery(req, 'count'),
      cursor: getStringQuery(req, 'cursor') ?? getStringQuery(req, 'after'),
    })
  },
  run({ params, serverKey }) {
    return exploreCli({
      serverKey: serverKey!,
      ...params,
    })
  },
  fallbackSuggestion: 'Try a supported sort/type pair and lower the limit.',
})
