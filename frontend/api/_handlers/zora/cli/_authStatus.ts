import { authStatusCli } from '../../../../server/zora/cliCompat.js'
import { zoraCliRoutePaths } from './_routes.js'
import { okParams, withCliReadHandler } from './_shared.js'

export default withCliReadHandler({
  endpointPath: zoraCliRoutePaths.authStatus,
  cacheSeconds: 30,
  requireServerKey: false,
  parse() {
    return okParams({})
  },
  run() {
    return authStatusCli()
  },
})
