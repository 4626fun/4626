import type { Address } from 'viem'

/**
 * A selectable swap asset. ERC-1155 keys deliberately retain their contract
 * and token id: treating a FriendKey like an ERC-20 loses the asset identity.
 */
export type SwapAssetRef =
  | { kind: 'erc20'; chainId: number; address: Address }
  | { kind: 'erc1155-key'; chainId: 8453; contractAddress: Address; tokenId: bigint }

export function swapAssetId(asset: SwapAssetRef): string {
  if (asset.kind === 'erc20') {
    return `erc20:${asset.chainId}:${asset.address.toLowerCase()}`
  }
  return `erc1155-key:${asset.chainId}:${asset.contractAddress.toLowerCase()}:${asset.tokenId.toString()}`
}

export function sameSwapAsset(a: SwapAssetRef | null | undefined, b: SwapAssetRef | null | undefined): boolean {
  return Boolean(a && b && swapAssetId(a) === swapAssetId(b))
}
