import { describe, expect, it } from 'vitest'

import { getV1ApiHandler } from '../_handlers/_routes.v1.ts'
import tokenImageHandler from '../_handlers/token/_image.ts'

const TOKEN = '0x1111111111111111111111111111111111111111'

describe('token image route registration', () => {
  it('keeps metadata and tokenlist in the v1 route family while moving image handling to the root catch-all', async () => {
    expect(tokenImageHandler).toBeTypeOf('function')
    await expect(getV1ApiHandler(`token/${TOKEN}/metadata`)).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`token/${TOKEN}/image`)).resolves.toBeNull()
  })

  it('keeps logo aliases out of the v1 family so Vercel rewrites can target /api/token/image', async () => {
    await expect(getV1ApiHandler(`token/${TOKEN}/logo.png`)).resolves.toBeNull()
    await expect(getV1ApiHandler(`token/${TOKEN}/logo.svg`)).resolves.toBeNull()
  })

  it('registers token list output route', async () => {
    await expect(getV1ApiHandler(`token/${TOKEN}/tokenlist`)).resolves.toBeTypeOf('function')
  })
})
