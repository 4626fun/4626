import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { apiFetch } from '@/lib/api/apiBase'
import { ALFACLUB } from '@/lib/alfaclub/contracts'
import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'
import { alfaclubRoomPrimaryTitle } from '@/lib/alfaclub/roomLabel'
import { AKITA_DEFAULTS } from '@/config/contracts.defaults'
import type { SwapAssetRef } from '@/lib/swap/swapAssetIdentity'
import { creatorCoinRawLogo } from '@/lib/uniswap/swapUtils'

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

/** ERC-1155 label for swap chrome — room name when known, else AKITA / #id. */
export function formatAlfaClubKeyLabel(params: {
  keyId: string | number | bigint
  roomName?: string | null
  displayLabel?: string | null
  creatorHandle?: string | null
}): string {
  const keyId = String(params.keyId)
  const titled = alfaclubRoomPrimaryTitle({
    roomId: keyId,
    roomName: params.roomName,
    displayLabel: params.displayLabel,
    creatorHandle: params.creatorHandle,
  })
  if (titled === `Room #${keyId}`) {
    return keyId === ALFACLUB_EXECUTABLE_KEY_ID.toString() ? 'AKITA' : `#${keyId}`
  }
  return titled
}

/** Room avatar, with AKITA creator-coin artwork as the #1659 fallback. */
export function resolveAlfaClubKeyImageUrl(params: {
  keyId: string
  imageUrl?: string | null
}): string | null {
  const trimmed = params.imageUrl?.trim()
  if (trimmed) return trimmed
  if (params.keyId === ALFACLUB_EXECUTABLE_KEY_ID.toString()) {
    return creatorCoinRawLogo(AKITA_DEFAULTS.token, ALFACLUB.chainId)
  }
  return null
}

function toKeyOption(room: AlfaClubRoomDirectoryItem): AlfaClubKeyOption {
  return {
    assetKind: 'erc1155-key',
    contractAddress: ALFACLUB.friendKey,
    keyId: room.roomId,
    label: formatAlfaClubKeyLabel({
      keyId: room.roomId,
      roomName: room.roomName,
      displayLabel: room.displayLabel,
      creatorHandle: room.creatorHandle,
    }),
    imageUrl: resolveAlfaClubKeyImageUrl({
      keyId: room.roomId,
      imageUrl: room.imageUrl,
    }),
    creatorHandle: room.creatorHandle,
    marketReady: room.roomId === ALFACLUB_EXECUTABLE_KEY_ID.toString(),
    asset: {
      kind: 'erc1155-key',
      chainId: ALFACLUB.chainId,
      contractAddress: ALFACLUB.friendKey,
      tokenId: BigInt(room.roomId),
    },
  }
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
  const keys = ranked.slice(0, limit).map(toKeyOption)
  return keys.length > 0
    ? keys
    : [{
        assetKind: 'erc1155-key',
        contractAddress: ALFACLUB.friendKey,
        keyId: ALFACLUB_EXECUTABLE_KEY_ID.toString(),
        label: formatAlfaClubKeyLabel({ keyId: ALFACLUB_EXECUTABLE_KEY_ID, roomName: 'AKITA' }),
        imageUrl: resolveAlfaClubKeyImageUrl({
          keyId: ALFACLUB_EXECUTABLE_KEY_ID.toString(),
        }),
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
