import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

async function readRepoFile(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), 'utf8')
}

describe('Solana registry key naming', () => {
  test('registry seeding scripts prefer SOLANA_REGISTRY_KEY with a deprecated fallback alias', async () => {
    const [seedRegistry, operationalWiring, seedSolanaPeer] = await Promise.all([
      readRepoFile('script', 'SeedCreatorRegistry.s.sol'),
      readRepoFile('script', 'OperationalWiring.s.sol'),
      readRepoFile('script', 'SeedCreatorRegistrySolanaPeer.s.sol'),
    ])

    for (const source of [seedRegistry, operationalWiring, seedSolanaPeer]) {
      expect(source).toContain('SOLANA_REGISTRY_KEY')
      expect(source).toContain('SOLANA_CHAIN_ID')
      expect(source).toContain('deprecated')
    }
  })

  test('registry-facing Solana wording is explicit about registry-key semantics', async () => {
    const [seedRegistry, operationalWiring, seedSolanaPeer] = await Promise.all([
      readRepoFile('script', 'SeedCreatorRegistry.s.sol'),
      readRepoFile('script', 'OperationalWiring.s.sol'),
      readRepoFile('script', 'SeedCreatorRegistrySolanaPeer.s.sol'),
    ])

    expect(seedRegistry).toContain('registry key <-> EID')
    expect(operationalWiring).toContain('registry key <-> EID')
    expect(seedSolanaPeer).toContain('registry key <-> EID')
  })
})
