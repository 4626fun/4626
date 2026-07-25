import { getAddress, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import type { CreatorVaultBatcherInfra } from './deploymentBatcherInfra'
import { resolveDeployVanityPlan } from './resolveDeployVanityPlan'

const BATCHER = getAddress('0x1111111111111111111111111111111111111111')
const DEPLOYER = getAddress('0x2222222222222222222222222222222222222222')
const CREATOR = getAddress('0x3333333333333333333333333333333333333333')
const OWNER = getAddress('0x4444444444444444444444444444444444444444')
const MANUAL_SALT = `0x${'55'.repeat(32)}` as Hex
const BATCHER_INFRA: CreatorVaultBatcherInfra = {
  create2Deployer: DEPLOYER,
  bytecodeStore: getAddress('0x5555555555555555555555555555555555555555'),
  protocolTreasury: getAddress('0x6666666666666666666666666666666666666666'),
  registry: getAddress('0x7777777777777777777777777777777777777777'),
  chainlinkEthUsd: getAddress('0x8888888888888888888888888888888888888888'),
  batcherBytecode: null,
  capabilities: {
    saltOverridesDisabledByBatcher: false,
    supportsLegacyPhase1WithSaltSelector: false,
    supportsSplitPhase1WithSaltSelectors: true,
    supportsPhase1WithSalt: true,
  },
}

function resolvePlan(shareOftVanitySuffix: string, shareVanityIsCustom: boolean) {
  return resolveDeployVanityPlan({
    publicClient: { getBytecode: async () => '0x' },
    batcherAddress: BATCHER,
    batcherInfra: BATCHER_INFRA,
    creatorToken: CREATOR,
    owner: OWNER,
    chainId: 8453,
    deploymentVersion: 'v1.19.3-p1-regression',
    shareOftSaltOverride: MANUAL_SALT,
    vaultName: 'Creator Vault',
    vaultSymbol: 'cvTEST',
    shareName: 'Creator Vault Share',
    shareSymbol: 'cvTEST',
    vaultVanityPrefix: '4626',
    shareOftVanitySuffix,
    vaultVanityMaxTries: 1,
    shareOftVanityMaxTries: 1,
    shareVanityIsCustom,
    cacheState: {
      vaultVanityVersion: null,
      shareOftVanity: null,
      shareOftVanitySkipLogKey: null,
    },
    shortAddress: (value) => value,
  })
}

describe('resolveDeployVanityPlan validation', () => {
  it('rejects a mismatching manual custom share suffix when only the default vault prefix misses', async () => {
    await expect(resolvePlan('dead', true)).rejects.toThrow('does not satisfy required suffix dead')
  })

  it('keeps a genuine default share suffix miss best-effort', async () => {
    const plan = await resolvePlan('4626', false)

    expect(plan.vanityVersionSearchOutcome).toBe('missed_defaults')
    expect(plan.shareOftSaltOverrideUsed).toBe(MANUAL_SALT)
  })
})
