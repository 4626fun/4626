import { concatHex, encodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem'

export type CreatorPayoutRouterConstructorParams = {
  creatorToken: Address
  vault: Address
  burnStream: Address
  shareOFT: Address
  wrapper: Address
  owner: Address
  swapRouter: Address
  weth: Address
  protocolRewards: Address
}

const CREATOR_PAYOUT_ROUTER_CONSTRUCTOR_PARAMETERS = parseAbiParameters(
  'address,address,address,address,address,address,address,address,address',
)

export function encodeCreatorPayoutRouterConstructorArgs(
  params: CreatorPayoutRouterConstructorParams,
): Hex {
  return encodeAbiParameters(CREATOR_PAYOUT_ROUTER_CONSTRUCTOR_PARAMETERS, [
    params.creatorToken,
    params.vault,
    params.burnStream,
    params.shareOFT,
    params.wrapper,
    params.owner,
    params.swapRouter,
    params.weth,
    params.protocolRewards,
  ])
}

export function buildCreatorPayoutRouterInitCode(params: {
  bytecode: Hex
  constructorParams: CreatorPayoutRouterConstructorParams
}): Hex {
  return concatHex([
    params.bytecode,
    encodeCreatorPayoutRouterConstructorArgs(params.constructorParams),
  ])
}
