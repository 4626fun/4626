import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('token image handler import safety', () => {
  it('does not import viem/chains barrel (prevents EMFILE module fanout)', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'api/_handlers/token/_image.ts'),
      'utf8',
    )

    expect(source).not.toContain("from 'viem/chains'")
    expect(source).not.toContain('from "viem/chains"')
  })

  it('keeps ShareOFT contractURI + token image fallback wiring in metadata hook', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/hooks/useTokenMetadata.ts'),
      'utf8',
    )

    expect(source).toContain("name: 'contractURI'")
    expect(source).toContain('resolveDexscreenerTokenImageUrl')
    expect(source).toContain('https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(tokenAddress.toLowerCase())}')
    expect(source).toContain('refetchContractURI')
  })
})
