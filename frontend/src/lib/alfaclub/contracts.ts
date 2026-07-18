import { parseAbi, type Address } from 'viem'

export const ALFACLUB = {
  friendKey: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F' as Address,
  friendStakeBeacon: '0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9' as Address,
  friendPool: '0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d' as Address,
  chainId: 8453,
} as const

export const FRIEND_KEY_ABI = parseAbi([
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function creatorByTokenId(uint256 tokenId) view returns (address)',
  'function roomTypes(uint256 tokenId) view returns (uint8)',
  'function roomTiers(uint256 tokenId) view returns (uint8)',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)',
  'function getSellPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)',
  'function getKeyHoldingSince(uint256 tokenId, address user) view returns (uint256)',
  'function bondingToken() view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
])

export const SUDOSWAP_ERC1155_ERC20_PAIR_ABI = parseAbi([
  'function factory() view returns (address)',
  'function pairVariant() pure returns (uint8)',
  'function poolType() view returns (uint8)',
  'function token() view returns (address)',
  'function nft() view returns (address)',
  'function nftId() pure returns (uint256)',
  'function bondingCurve() view returns (address)',
  'function fee() view returns (uint96)',
  'function spotPrice() view returns (uint128)',
  'function delta() view returns (uint128)',
  'function getBuyNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 inputAmount, uint256 protocolFee, uint256 royaltyAmount)',
  'function getSellNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 outputAmount, uint256 protocolFee, uint256 royaltyAmount)',
])

export const SUDOSWAP_PAIR_FACTORY_ABI = parseAbi([
  'function isValidPair(address pair) view returns (bool)',
  'function routerStatus(address router) view returns (bool allowed, bool wasEverTouched)',
])

export const ALFACLUB_SUDOSWAP_ADAPTER_ABI = parseAbi([
  'function factory() view returns (address)',
  'function permit2() view returns (address)',
  'function friendKey() view returns (address)',
  'function xykCurve() view returns (address)',
  'function universalRouter() view returns (address)',
  'function markets(address pair) view returns (address creatorCoin, uint256 tokenId, bool allowed)',
])

export const PERMIT2_ALLOWANCE_TRANSFER_ABI = parseAbi([
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
])

export const ALFACLUB_UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
  'function SUDOSWAP_ADAPTER() view returns (address)',
])
