import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'

import { readPhase3HelperBytecodeAligned } from './ensurePhase3DryRunHelperOnFork.js'

describe('readPhase3HelperBytecodeAligned', () => {
  it('treats bytecode match with mismatched batcher immutable as misaligned', async () => {
    const batcher = getAddress('0x9Bf56BD1e23019Af9Ac53f9110E582D9d7228cD4')
    const phase3Helper = getAddress('0xE0971a924E33251556fE73a4025166701b772dBe')
    const wiredBatcher = getAddress('0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1')

    const result = await readPhase3HelperBytecodeAligned({
      batcher,
      publicClient: {
        readContract: async (args) => {
          if (args.functionName === 'phase3Helper') return phase3Helper
          if (args.functionName === 'batcher') return wiredBatcher
          throw new Error(`unexpected readContract ${args.functionName}`)
        },
        getBytecode: async () => {
          const { readFileSync } = await import('node:fs')
          const path = await import('node:path')
          const { fileURLToPath } = await import('node:url')
          const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
          const artifactPath = path.join(
            repoRoot,
            'out/DeploymentBatcher.sol/DeploymentBatcherPhase3Helper.json',
          )
          const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
            deployedBytecode?: { object?: string }
          }
          return artifact.deployedBytecode?.object as `0x${string}`
        },
      },
    })

    expect(result.batcherImmutableAligned).toBe(false)
    expect(result.wiredBatcher).toBe(wiredBatcher)
    expect(result.aligned).toBe(false)
  })
})
