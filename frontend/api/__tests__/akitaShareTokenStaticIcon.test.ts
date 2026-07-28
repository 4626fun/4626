import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SHARE_OFT = '0x44710150a469de368abc82f05e6217086be84626'

describe('Akita Share Token static icon', () => {
  it('keeps curated PNG + Metaplex JSON in public/tokens', async () => {
    const png = await readFile(resolve(process.cwd(), 'public/tokens/akita-share-token.png'))
    const jsonRaw = await readFile(
      resolve(process.cwd(), 'public/tokens/akita-share-token.json'),
      'utf8',
    )
    const meta = JSON.parse(jsonRaw) as {
      name?: string
      symbol?: string
      image?: string
    }

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.byteLength).toBeGreaterThan(50_000)
    expect(meta.name).toBe('Akita Share Token')
    expect(meta.symbol).toBe('■AKITA')
    expect(meta.image).toBe('https://4626.fun/tokens/akita-share-token.png')
  })

  it('wires ShareOFT address to static icon path and bundles the PNG', async () => {
    const imageSrc = await readFile(
      resolve(process.cwd(), 'api/_handlers/token/_image.ts'),
      'utf8',
    )
    const vercelRaw = await readFile(resolve(process.cwd(), 'vercel.json'), 'utf8')

    expect(imageSrc).toContain(SHARE_OFT)
    expect(imageSrc).toContain('/tokens/akita-share-token.png')
    expect(imageSrc).toContain('STATIC_SHARE_TOKEN_ICON_BY_ADDRESS')
    expect(vercelRaw).toContain('public/tokens/akita-share-token.png')
  })
})
