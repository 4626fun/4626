import { describe, expect, it } from 'vitest'

import { getApiHandler } from '../_handlers/_routes.ts'

const TOKEN = '0x1111111111111111111111111111111111111111'

describe('token image route registration', () => {
  it('registers canonical v1 token metadata and image handlers', async () => {
    await expect(getApiHandler(`v1/token/${TOKEN}/metadata`)).resolves.toBeTypeOf('function')
    await expect(getApiHandler(`v1/token/${TOKEN}/image`)).resolves.toBeTypeOf('function')
  })

  it('registers extension-based v1 token logo aliases', async () => {
    await expect(getApiHandler(`v1/token/${TOKEN}/logo.png`)).resolves.toBeTypeOf('function')
    await expect(getApiHandler(`v1/token/${TOKEN}/logo.svg`)).resolves.toBeTypeOf('function')
  })

  it('registers token list output route', async () => {
    await expect(getApiHandler(`v1/token/${TOKEN}/tokenlist`)).resolves.toBeTypeOf('function')
  })
})
