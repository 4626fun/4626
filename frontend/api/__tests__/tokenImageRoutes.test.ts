import { describe, expect, it } from 'vitest'

import { getApiHandler } from '../_handlers/_routes.ts'
import standaloneHandler from '../token/image.ts'

const TOKEN = '0x1111111111111111111111111111111111111111'

describe('token image route registration', () => {
  it('keeps metadata in the catch-all but moves image handling to a standalone entrypoint', async () => {
    expect(standaloneHandler).toBeTypeOf('function')
    await expect(getApiHandler(`v1/token/${TOKEN}/metadata`)).resolves.toBeTypeOf('function')
    await expect(getApiHandler(`v1/token/${TOKEN}/image`)).resolves.toBeNull()
  })

  it('removes logo aliases from the catch-all so Vercel rewrites can target the standalone image route', async () => {
    await expect(getApiHandler(`v1/token/${TOKEN}/logo.png`)).resolves.toBeNull()
    await expect(getApiHandler(`v1/token/${TOKEN}/logo.svg`)).resolves.toBeNull()
  })

  it('registers token list output route', async () => {
    await expect(getApiHandler(`v1/token/${TOKEN}/tokenlist`)).resolves.toBeTypeOf('function')
  })
})
