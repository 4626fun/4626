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

export const ALFA_CREATOR_KEY_LP_FACTORY_ABI = parseAbi([
  'function poolCreatorAllowed(address account) view returns (bool)',
  'function pairAllowed(address creatorCoin, uint256 tokenId) view returns (bool)',
  'function getPool(address creatorCoin, uint256 tokenId) view returns (address)',
  'function createPoolWithInitialLiquidity(address creatorCoin, uint256 tokenId, uint256 keyAmount, uint256 creatorCoinAmount, address recipient) returns (address)',
])

export const ALFA_CREATOR_KEY_POOL_ABI = parseAbi([
  'function addLiquidity(uint256 keyAmount, uint256 maxCreatorCoinAmount, uint256 minLpShares, address recipient) returns (uint256 creatorCoinAmount, uint256 lpShares)',
  'function removeLiquidity(uint256 lpShares, uint256 minCreatorCoinAmount, uint256 minKeyAmount, address recipient) returns (uint256 creatorCoinAmount, uint256 keyAmount)',
  'function buyKeys(uint256 keyAmount, uint256 maxCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountIn)',
  'function sellKeys(uint256 keyAmount, uint256 minCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountOut)',
  'function quoteAddLiquidity(uint256 keyAmount) view returns (uint256 creatorCoinAmount, uint256 lpShares)',
  'function quoteBuyKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountIn)',
  'function quoteSellKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountOut)',
  'function getReserves() view returns (uint256 creatorCoinReserve, uint256 keyReserve)',
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
])
