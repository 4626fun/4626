import {
  concatHex,
  encodeAbiParameters,
  getAddress,
  getCreate2Address,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'

import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import type { CreatorVaultBatcherInfra } from '@/lib/deploy/creatorVaultBatcherInfra'
import type { DeployVanityPlan } from '@/lib/deploy/resolveDeployVanityPlan'
import {
  deriveCreatorCoinPolicyControllerSalt,
  derivePayoutRouterSalt,
  deriveVaultShareBurnStreamSalt,
} from '@/lib/deploy/create2Salts'
import {
  deriveDeployBaseSalt,
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '@/lib/deploy/perVaultVanityVersionSearch'
import { resolveBytecodeStoreForBatcher } from '@/lib/deploy/phase1ModuleDeploy'

const BASE_SWAP_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as Address
const BASE_WETH = '0x4200000000000000000000000000000000000006' as Address
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export type DeployExpectedAddresses = {
  vault: Address
  wrapper: Address
  shareOFT: Address
  gaugeController: Address
  ccaStrategy: Address
  oracle: Address
  burnStream: Address
  payoutRouter: Address
  creatorCoinPolicyController: Address
}

export type ResolveDeployExpectedAddressesResult = {
  create2Deployer: Address
  protocolTreasury: Address
  deploymentVersion: string
  shareOftSaltOverride: Hex | null
  shareOftVanityWarning: string | null
  shareOftVanityInfo: string | null
  expected: DeployExpectedAddresses
}

type PublicClientLike = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

export type ResolveDeployExpectedAddressesParams = {
  publicClient: PublicClientLike
  batcherAddress: Address
  batcherInfra: CreatorVaultBatcherInfra
  creatorToken: Address
  owner: Address
  chainId: number
  vanityPlan: DeployVanityPlan
  universalBytecodeStoreFallback: Address | null
  wethAddress: Address
  vaultShareBurnStreamCodeId: Hex
  payoutRouterCodeId: Hex
  creatorCoinPolicyControllerCodeId: Hex
}

export async function resolveDeployExpectedAddresses(
  params: ResolveDeployExpectedAddressesParams,
): Promise<ResolveDeployExpectedAddressesResult> {
  const create2Deployer = params.batcherInfra.create2Deployer
  const protocolTreasury = params.batcherInfra.protocolTreasury
  const registryAddress = params.batcherInfra.registry
  const chainlinkEthUsd = params.batcherInfra.chainlinkEthUsd
  const tempOwner = params.batcherAddress
  const {
    deploymentVersionUsed,
    shareOftSaltOverrideUsed,
    shareOftVanityWarning,
    shareOftVanityInfo,
    vaultInitCode,
    shareOftInitCode,
    shareSymbolLower,
    vaultAddress,
  } = params.vanityPlan

  const baseSalt = deriveDeployBaseSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
    chainId: params.chainId,
    version: deploymentVersionUsed,
  })
  const wrapperSalt = saltForDeployLabel(baseSalt, 'wrapper')
  const gaugeSalt = saltForDeployLabel(baseSalt, 'gauge')
  const ccaSalt = saltForDeployLabel(baseSalt, 'cca')
  const oracleSalt = saltForDeployLabel(baseSalt, 'oracle')

  const derivedShareOftSalt = deriveShareOftSaltFromVersion({
    owner: params.owner,
    shareSymbol: shareSymbolLower,
    version: deploymentVersionUsed,
  })
  const shareOftSalt = shareOftSaltOverrideUsed ?? derivedShareOftSalt
  const shareOftAddress = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: shareOftSalt,
    initCode: shareOftInitCode,
  })

  const weth = getAddress(params.wethAddress)
  const burnStreamSalt = deriveVaultShareBurnStreamSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
  })
  const burnStreamArgs = encodeAbiParameters(parseAbiParameters('address'), [vaultAddress])
  const burnStreamInitCode = concatHex([DEPLOY_BYTECODE.VaultShareBurnStream as Hex, burnStreamArgs])
  const payoutRouterSalt = derivePayoutRouterSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
  })
  const creatorCoinPolicyControllerSalt = deriveCreatorCoinPolicyControllerSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
  })

  const phase2AuxAddresses = await (async () => {
    let burnStreamAddress = predictCreate2AddressFromInitCode({
      create2Deployer,
      salt: burnStreamSalt,
      initCode: burnStreamInitCode,
    })
    let payoutRouterAddress = (() => {
      const args = encodeAbiParameters(
        parseAbiParameters('address,address,address,address,address,address,address'),
        [
          params.creatorToken,
          vaultAddress,
          burnStreamAddress,
          protocolTreasury,
          getAddress(BASE_SWAP_ROUTER),
          weth,
          ZERO_ADDRESS,
        ],
      )
      const init = concatHex([DEPLOY_BYTECODE.PayoutRouter as Hex, args])
      return predictCreate2AddressFromInitCode({
        create2Deployer,
        salt: payoutRouterSalt,
        initCode: init,
      })
    })()
    let creatorCoinPolicyControllerAddress = (() => {
      const args = encodeAbiParameters(parseAbiParameters('address,address,address'), [
        params.creatorToken,
        payoutRouterAddress,
        protocolTreasury,
      ])
      const init = concatHex([DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex, args])
      return predictCreate2AddressFromInitCode({
        create2Deployer,
        salt: creatorCoinPolicyControllerSalt,
        initCode: init,
      })
    })()

    try {
      const BYTECODE_STORE_GET_ABI = [
        {
          type: 'function',
          name: 'get',
          stateMutability: 'view',
          inputs: [{ name: 'codeId', type: 'bytes32' }],
          outputs: [{ name: 'creationCode', type: 'bytes' }],
        },
      ] as const

      const bytecodeStore = await resolveBytecodeStoreForBatcher({
        publicClient: params.publicClient as Parameters<typeof resolveBytecodeStoreForBatcher>[0]['publicClient'],
        batcherAddress: params.batcherAddress,
        fallback: params.universalBytecodeStoreFallback,
      })

      if (bytecodeStore) {
        const [burnCreation, routerCreation, policyControllerCreation] = (await Promise.all([
          params.publicClient.readContract({
            address: bytecodeStore,
            abi: BYTECODE_STORE_GET_ABI,
            functionName: 'get',
            args: [params.vaultShareBurnStreamCodeId],
          }),
          params.publicClient.readContract({
            address: bytecodeStore,
            abi: BYTECODE_STORE_GET_ABI,
            functionName: 'get',
            args: [params.payoutRouterCodeId],
          }),
          params.publicClient.readContract({
            address: bytecodeStore,
            abi: BYTECODE_STORE_GET_ABI,
            functionName: 'get',
            args: [params.creatorCoinPolicyControllerCodeId],
          }),
        ])) as [Hex, Hex, Hex]

        const burnInitHash = keccak256(concatHex([burnCreation as Hex, burnStreamArgs]))
        burnStreamAddress = getCreate2Address({
          from: create2Deployer,
          salt: burnStreamSalt,
          bytecodeHash: burnInitHash,
        })

        const routerArgsFixed = encodeAbiParameters(
          parseAbiParameters('address,address,address,address,address,address,address'),
          [
            params.creatorToken,
            vaultAddress,
            burnStreamAddress,
            protocolTreasury,
            getAddress(BASE_SWAP_ROUTER),
            weth,
            ZERO_ADDRESS,
          ],
        )
        const routerInitHash = keccak256(concatHex([routerCreation as Hex, routerArgsFixed]))
        payoutRouterAddress = getCreate2Address({
          from: create2Deployer,
          salt: payoutRouterSalt,
          bytecodeHash: routerInitHash,
        })

        const policyControllerArgsFixed = encodeAbiParameters(parseAbiParameters('address,address,address'), [
          params.creatorToken,
          payoutRouterAddress,
          protocolTreasury,
        ])
        const policyControllerInitHash = keccak256(
          concatHex([policyControllerCreation as Hex, policyControllerArgsFixed]),
        )
        creatorCoinPolicyControllerAddress = getCreate2Address({
          from: create2Deployer,
          salt: creatorCoinPolicyControllerSalt,
          bytecodeHash: policyControllerInitHash,
        })
      }
    } catch {
      // Best-effort: fall back to local bytecode predictions
    }

    return {
      burnStreamAddress,
      payoutRouterAddress,
      creatorCoinPolicyControllerAddress,
    }
  })()

  const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
    params.creatorToken,
    vaultAddress,
    tempOwner,
  ])
  const wrapperInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperArgs])
  const wrapperAddress = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: wrapperSalt,
    initCode: wrapperInitCode,
  })

  const gaugeArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
    shareOftAddress,
    protocolTreasury,
    protocolTreasury,
    tempOwner,
  ])
  const gaugeInitCode = concatHex([DEPLOY_BYTECODE.CreatorGaugeController as Hex, gaugeArgs])
  const gaugeAddress = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: gaugeSalt,
    initCode: gaugeInitCode,
  })

  const ccaArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address'), [
    shareOftAddress,
    ZERO_ADDRESS,
    vaultAddress,
    vaultAddress,
    tempOwner,
  ])
  const ccaInitCode = concatHex([DEPLOY_BYTECODE.CCALaunchStrategy as Hex, ccaArgs])
  const ccaAddress = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: ccaSalt,
    initCode: ccaInitCode,
  })

  const oracleArgs = encodeAbiParameters(parseAbiParameters('address,address,string,address'), [
    registryAddress,
    chainlinkEthUsd,
    shareSymbolLower,
    tempOwner,
  ])
  const oracleInitCode = concatHex([DEPLOY_BYTECODE.CreatorOracle as Hex, oracleArgs])
  const oracleAddress = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: oracleSalt,
    initCode: oracleInitCode,
  })

  return {
    create2Deployer,
    protocolTreasury,
    deploymentVersion: deploymentVersionUsed,
    shareOftSaltOverride: shareOftSaltOverrideUsed,
    shareOftVanityWarning,
    shareOftVanityInfo,
    expected: {
      vault: vaultAddress,
      wrapper: wrapperAddress,
      shareOFT: shareOftAddress,
      gaugeController: gaugeAddress,
      ccaStrategy: ccaAddress,
      oracle: oracleAddress,
      burnStream: phase2AuxAddresses.burnStreamAddress,
      payoutRouter: phase2AuxAddresses.payoutRouterAddress,
      creatorCoinPolicyController: phase2AuxAddresses.creatorCoinPolicyControllerAddress,
    },
  }
}