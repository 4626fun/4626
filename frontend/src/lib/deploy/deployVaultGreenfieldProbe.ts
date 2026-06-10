import { concatHex, encodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem'

import {
  deriveDeployBaseSalt,
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '@/lib/deploy/perVaultVanityVersionSearch'

type PublicClientLike = {
  getBytecode: (args: { address: Address }) => Promise<Hex | null | undefined>
}

export async function probeGreenfieldPhase1Deploy(params: {
  publicClient: PublicClientLike
  create2Deployer: Address
  batcherAddress: Address
  creatorToken: Address
  owner: Address
  chainId: number
  deploymentVersion: string
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbol: string
  wrapperBytecode: Hex
}): Promise<boolean> {
  const baseSalt = deriveDeployBaseSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
    chainId: params.chainId,
    version: params.deploymentVersion,
  })
  const vaultSalt = saltForDeployLabel(baseSalt, 'vault')
  const wrapperSalt = saltForDeployLabel(baseSalt, 'wrapper')
  const shareSalt = deriveShareOftSaltFromVersion({
    owner: params.owner,
    shareSymbol: params.shareSymbol,
    version: params.deploymentVersion,
  })

  const vaultAddress = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: vaultSalt,
    initCode: params.vaultInitCode,
  })
  const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
    params.creatorToken,
    vaultAddress,
    params.batcherAddress,
  ])
  const wrapperInitCode = concatHex([params.wrapperBytecode, wrapperArgs])
  const wrapperAddress = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: wrapperSalt,
    initCode: wrapperInitCode,
  })
  const shareAddress = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: shareSalt,
    initCode: params.shareOftInitCode,
  })

  const codes = await Promise.all(
    [vaultAddress, wrapperAddress, shareAddress].map((address) =>
      params.publicClient.getBytecode({ address }).catch(() => null),
    ),
  )
  return codes.every((code) => !code || code === '0x')
}