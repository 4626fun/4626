import type { VercelRequest } from '@vercel/node'

import {
  getNumberQuery,
  getStringQuery,
} from '../../../../server/zora/_shared.js'
import { profileCli } from '../../../../server/zora/cliCompat.js'
import { zoraCliRoutePaths } from './_routes.js'
import { okParams, parseError, withCliReadHandler } from './_shared.js'

export default withCliReadHandler({
  endpointPath: zoraCliRoutePaths.profile,
  cacheSeconds: 120,
  parse(req: VercelRequest) {
    const identifier =
      getStringQuery(req, 'identifier') ?? getStringQuery(req, 'id') ?? getStringQuery(req, 'handle')
    if (!identifier) {
      return parseError(400, 'Missing identifier.', 'Provide identifier=<handle|address>.')
    }

    return okParams({
      identifier,
      limit: getNumberQuery(req, 'limit') ?? getNumberQuery(req, 'count'),
      cursor: getStringQuery(req, 'cursor') ?? getStringQuery(req, 'after'),
    })
  },
  run({ params, serverKey }) {
    return profileCli({
      serverKey: serverKey!,
      ...params,
    })
  },
  fallbackSuggestion: 'Verify the profile identifier and try again.',
})
