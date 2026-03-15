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

  it('keeps ShareOFT contractURI + canonical image fallback wiring in metadata hook', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/hooks/useTokenMetadata.ts'),
      'utf8',
    )

    expect(source).toContain("name: 'contractURI'")
    expect(source).toContain('buildCanonicalTokenImageUrl')
    expect(source).toContain('/api/v1/token/${tokenAddress.toLowerCase()}/image?chain=8453&format=png')
    expect(source).toContain('refetchContractURI')
  })
})
