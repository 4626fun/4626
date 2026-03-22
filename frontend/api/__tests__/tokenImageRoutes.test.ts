import { describe, expect, it } from 'vitest'

import { getV1ApiHandler } from '../_handlers/_routes.v1.ts'
import standaloneHandler from '../token/image.ts'

const TOKEN = '0x1111111111111111111111111111111111111111'

describe('token image route registration', () => {
  it('keeps metadata and tokenlist in the v1 route family while moving image handling to a standalone entrypoint', async () => {
    expect(standaloneHandler).toBeTypeOf('function')
    await expect(getV1ApiHandler(`token/${TOKEN}/metadata`)).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`token/${TOKEN}/image`)).resolves.toBeNull()
  })

  it('removes logo aliases from the catch-all so Vercel rewrites can target the standalone image route', async () => {
    await expect(getV1ApiHandler(`token/${TOKEN}/logo.png`)).resolves.toBeNull()
    await expect(getV1ApiHandler(`token/${TOKEN}/logo.svg`)).resolves.toBeNull()
  })

  it('registers token list output route', async () => {
    await expect(getV1ApiHandler(`token/${TOKEN}/tokenlist`)).resolves.toBeTypeOf('function')
  })
})
