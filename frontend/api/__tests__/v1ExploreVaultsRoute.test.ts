import { describe, expect, it } from 'vitest'

import { getV1ApiHandler } from '../_handlers/_routes.v1.ts'

describe('v1 explore vaults route registration', () => {
  it('registers explore/vaults in the v1 route family', async () => {
    await expect(getV1ApiHandler('explore/vaults')).resolves.toBeTypeOf('function')
  })
})
