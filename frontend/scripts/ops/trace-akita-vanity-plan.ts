#!/usr/bin/env node
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  parseAbiParameters,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'
import {
  deriveDeployBaseSalt,
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '../../src/lib/deploy/perVaultVanityVersionSearch.js'
import { findPerVaultVanityVersionOnServer } from '../../server/_lib/deploy/findPerVaultVanityVersionServer.js'
import { resolveAlignedPhase1DeployDeps } from '../../src/lib/deploy/phase1ModuleDeploy.js'
import {
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
} from '../../src/lib/tokens/tokenSymbols.js'

const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const OWNER = getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')
const TARGET_WRAPPER = getAddress('0xC07950ee51f56C18279D1dD9Cf42440dEE79674D')

async function main(): Promise<void> {
  const rpc = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
  const batcher = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const aligned = await resolveAlignedPhase1DeployDeps({ publicClient: client, batcherAddress: batcher })
  if (!aligned.ok) throw new Error(aligned.message)
  const create2 = aligned.create2Deployer

  const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
    CREATOR,
    batcher,
    toVaultName('AKITA'),
    toVaultSymbol('AKITA'),
  ])
  const vaultInit = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])
  const oftSalt = keccak256(toHex('4626:OFTBootstrapRegistry:v1'))
  const oft = predictCreate2AddressFromInitCode({
    create2Deployer: create2,
    salt: oftSalt,
    initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
  })
  const shareArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
    toShareName('AKITA'),
    toShareSymbol('AKITA'),
    oft,
    batcher,
  ])
  const shareInit = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareArgs])

  const maxTriesRaw = process.env.DEPLOY_COMBINED_VANITY_SERVER_MAX_TRIES?.trim()
  const maxTries = maxTriesRaw ? Number.parseInt(maxTriesRaw, 10) : 50_000_000
  let version: string | null = null
  let attempts = 0
  try {
    const result = await findPerVaultVanityVersionOnServer({
      create2Deployer: create2,
      creatorToken: CREATOR,
      owner: OWNER,
      chainId: 8453,
      baseVersion: 'v1.13.0',
      vaultPrefix: '4626',
      shareSuffix: '4626',
      maxTries,
      vaultInitCode: vaultInit,
      shareOftInitCode: shareInit,
      shareSymbol: 'AKITA',
    })
    version = result.version
    attempts = result.attempts
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('failed to find per-vault vanity version')) throw error
  }

  process.stdout.write(`vanityVersion=${version ?? 'NOT_FOUND'} attempts=${attempts} maxTries=${maxTries}\n`)
  if (!version) {
    process.stdout.write(
      'No version in search window. Use deploy UI WASM search or raise DEPLOY_COMBINED_VANITY_SERVER_MAX_TRIES.\n',
    )
    return
  }

  const baseSalt = deriveDeployBaseSalt({ creatorToken: CREATOR, owner: OWNER, chainId: 8453, version })
  const vaultSalt = saltForDeployLabel(baseSalt, 'vault')
  const wrapperSalt = saltForDeployLabel(baseSalt, 'wrapper')
  const vault = predictCreate2AddressFromInitCode({ create2Deployer: create2, salt: vaultSalt, initCode: vaultInit })
  const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [CREATOR, vault, batcher])
  const wrapperInit = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperArgs])
  const wrapper = predictCreate2AddressFromInitCode({
    create2Deployer: create2,
    salt: wrapperSalt,
    initCode: wrapperInit,
  })
  const shareSalt = deriveShareOftSaltFromVersion({ owner: OWNER, shareSymbol: 'AKITA', version })
  const share = predictCreate2AddressFromInitCode({ create2Deployer: create2, salt: shareSalt, initCode: shareInit })

  for (const [label, addr] of [
    ['vault', vault],
    ['wrapper', wrapper],
    ['share', share],
  ] as const) {
    const code = await client.getBytecode({ address: addr })
    process.stdout.write(
      `${label}=${addr} deployed=${Boolean(code && code !== '0x')} wrapperTargetMatch=${addr === TARGET_WRAPPER && label === 'wrapper'}\n`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})