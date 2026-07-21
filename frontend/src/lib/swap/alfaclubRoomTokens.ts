import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { apiFetch } from '@/lib/api/apiBase'
import { ALFACLUB } from '@/lib/alfaclub/contracts'
import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'
import type { SwapAssetRef } from '@/lib/swap/swapAssetIdentity'

export const ALFACLUB_EXECUTABLE_KEY_ID = 1659n

export type AlfaClubKeyOption = {
  assetKind: 'erc1155-key'
  contractAddress: `0x${string}`
  keyId: string
  label: string
  imageUrl?: string | null
  creatorHandle?: string | null
  balance?: bigint | null
  marketReady: boolean
  asset: Extract<SwapAssetRef, { kind: 'erc1155-key' }>
}

/** Resolve ERC-1155 FriendKeys for the picker. Creator coins are deliberately excluded. */
export function resolveAlfaClubKeys(params: {
  rooms?: readonly AlfaClubRoomDirectoryItem[]
  limit?: number
}): AlfaClubKeyOption[] {
  const limit = Math.max(1, Math.min(8, params.limit ?? 8))
  const ranked = [...(params.rooms ?? [])].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return (b.volumeUsdc ?? -1) - (a.volumeUsdc ?? -1)
  })
  const keys = ranked.slice(0, limit).map((room) => ({
    assetKind: 'erc1155-key' as const,
    contractAddress: ALFACLUB.friendKey,
    keyId: room.roomId,
    label: `Key #${room.roomId}`,
    imageUrl: room.imageUrl,
    creatorHandle: room.creatorHandle,
    marketReady: room.roomId === ALFACLUB_EXECUTABLE_KEY_ID.toString(),
    asset: {
      kind: 'erc1155-key' as const,
      chainId: ALFACLUB.chainId,
      contractAddress: ALFACLUB.friendKey,
      tokenId: BigInt(room.roomId),
    },
  }))
  return keys.length > 0
    ? keys
    : [{
        assetKind: 'erc1155-key',
        contractAddress: ALFACLUB.friendKey,
        keyId: ALFACLUB_EXECUTABLE_KEY_ID.toString(),
        label: 'Key #1659',
        marketReady: true,
        asset: {
          kind: 'erc1155-key',
          chainId: ALFACLUB.chainId,
          contractAddress: ALFACLUB.friendKey,
          tokenId: ALFACLUB_EXECUTABLE_KEY_ID,
        },
      }]
}

export async function fetchAlfaClubRoomsForTokenModal(
  signal?: AbortSignal,
): Promise<AlfaClubRoomDirectoryItem[]> {
  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.tradingRooms}?limit=40`, {
    method: 'GET',
    signal,
  })
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: { rows?: AlfaClubRoomDirectoryItem[] }
  } | null
  if (!response.ok || !payload?.success || !Array.isArray(payload.data?.rows)) return []
  return payload.data.rows
}
