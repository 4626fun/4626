#!/usr/bin/env tsx
/**
 * Mainnet read-only: AKITA greenfield Phase 1 slot probe for v1.14.0.
 *
 *   pnpm -C frontend exec tsx scripts/ops/probe-akita-v1140-greenfield.ts
 */
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  parseAbiParameters,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { AKITA_DEFAULTS, SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'
import { probeGreenfieldPhase1Deploy } from '../../src/lib/deploy/deployVaultGreenfieldProbe.js'
import {
  deriveDeployBaseSalt,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '../../src/lib/deploy/perVaultVanityVersionSearch.js'
import { resolveAlignedPhase1DeployDeps } from '../../src/lib/deploy/phase1ModuleDeploy.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const OWNER = getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')
const CREATOR = getAddress(AKITA_DEFAULTS.token)
const BATCHER = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
const VERSION = 'v1.14.0'

function rpcUrl(): string {
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
}

async function main(): Promise<void> {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl(), { timeout: 60_000 }) })
  const aligned = await resolveAlignedPhase1DeployDeps({ publicClient: client, batcherAddress: BATCHER })
  if (!aligned.ok) {
    process.stdout.write(`aligned deps failed: ${aligned.message}\n`)
    process.exit(1)
  }

  const vaultInitCode = DEPLOY_BYTECODE.CreatorOVault as Hex
  const shareOftInitCode = DEPLOY_BYTECODE.CreatorShareOFT as Hex
  const wrapperBytecode = DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex

  const greenfield = await probeGreenfieldPhase1Deploy({
    publicClient: client,
    create2Deployer: aligned.create2Deployer,
    batcherAddress: BATCHER,
    creatorToken: CREATOR,
    owner: OWNER,
    chainId: base.id,
    deploymentVersion: VERSION,
    vaultInitCode,
    shareOftInitCode,
    shareSymbol: 'AKITA',
    wrapperBytecode,
  })

  const baseSalt = deriveDeployBaseSalt({
    creatorToken: CREATOR,
    owner: OWNER,
    chainId: base.id,
    version: VERSION,
  })
  const vaultAddr = predictCreate2AddressFromInitCode({
    create2Deployer: aligned.create2Deployer,
    salt: saltForDeployLabel(baseSalt, 'vault'),
    initCode: vaultInitCode,
  })
  const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
    CREATOR,
    vaultAddr,
    BATCHER,
  ])
  const wrapperInit = concatHex([wrapperBytecode, wrapperArgs])
  const wrapperAddr = predictCreate2AddressFromInitCode({
    create2Deployer: aligned.create2Deployer,
    salt: saltForDeployLabel(baseSalt, 'wrapper'),
    initCode: wrapperInit,
  })

  process.stdout.write(
    `${JSON.stringify(
      {
        deploymentVersion: VERSION,
        create2Deployer: aligned.create2Deployer,
        greenfield,
        predicted: { vault: vaultAddr, wrapper: wrapperAddr },
        legacy: { vault: AKITA_DEFAULTS.vault, shareOFT: AKITA_DEFAULTS.shareOFT },
      },
      null,
      2,
    )}\n`,
  )

  if (!greenfield) process.exit(2)
}

main().catch((error) => {
  process.stdout.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})