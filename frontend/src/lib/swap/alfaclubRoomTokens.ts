import { getAddress, isAddress } from 'viem'

import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import { AKITA_DEFAULTS } from '@/config/contracts.defaults'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { apiFetch } from '@/lib/api/apiBase'
import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'
import {
  BASE_CHAIN_ID,
  shareTokenLogo,
} from '@/lib/uniswap/swapUtils'

export type AlfaClubRoomTokenPin = {
  roomId: string
  address: `0x${string}`
  symbol: string
  name: string
}

/** Curated AlfaClub room → creator-coin pins for the swap token modal. */
export const ALFACLUB_ROOM_TOKEN_PINS: readonly AlfaClubRoomTokenPin[] = [
  {
    roomId: '1659',
    address: AKITA_DEFAULTS.token,
    symbol: 'AKITA',
    name: 'AKITA',
  },
]

const MAX_ALFACLUB_ROOM_TOKENS = 8

function normalizeAddress(value: string): `0x${string}` | null {
  if (!isAddress(value)) return null
  return getAddress(value).toLowerCase() as `0x${string}`
}

function pinFallbackOption(pin: AlfaClubRoomTokenPin): SwapTokenOption {
  const address = normalizeAddress(pin.address) ?? pin.address
  return {
    address,
    symbol: pin.symbol,
    name: pin.name,
    group: 'creator',
    sectionTag: 'creator',
    verified: true,
    chainId: BASE_CHAIN_ID,
    logoUrl: shareTokenLogo(address, BASE_CHAIN_ID),
    alfaclubRoomId: pin.roomId,
  }
}

function matchCreatorOptionByRoomName(
  room: Pick<AlfaClubRoomDirectoryItem, 'roomName' | 'displayLabel'>,
  tokenOptions: readonly SwapTokenOption[],
): SwapTokenOption | null {
  const candidates = [room.roomName, room.displayLabel]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))
  if (candidates.length === 0) return null

  for (const option of tokenOptions) {
    if (option.sectionTag !== 'creator' && option.group !== 'creator') continue
    const symbol = option.symbol.trim().toLowerCase()
    const name = option.name.trim().toLowerCase()
    if (candidates.some((candidate) => candidate === symbol || candidate.startsWith(`${symbol} `))) {
      return option
    }
    if (candidates.some((candidate) => name === candidate || name.startsWith(`${candidate} `))) {
      return option
    }
  }
  return null
}

/**
 * Resolve AlfaClub room creator-coin tokens for the swap selector.
 * Prefers curated pins, then matches top/featured rooms to creator coins already
 * present in token options (by room name).
 *
 * Room image is stored on `alfaclubRoomImageUrl` for chip rendering only — never
 * overwrites the creator coin's `logoUrl`.
 */
export function resolveAlfaClubRoomTokens(params: {
  tokenOptions: readonly SwapTokenOption[]
  rooms?: readonly AlfaClubRoomDirectoryItem[]
  limit?: number
}): SwapTokenOption[] {
  const limit = Math.max(1, Math.min(MAX_ALFACLUB_ROOM_TOKENS, params.limit ?? MAX_ALFACLUB_ROOM_TOKENS))
  const seen = new Set<string>()
  const out: SwapTokenOption[] = []

  const push = (option: SwapTokenOption, roomId: string, roomImageUrl?: string | null) => {
    const key = option.address.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      ...option,
      sectionTag: 'creator',
      verified: option.verified !== false,
      alfaclubRoomId: roomId,
      alfaclubRoomImageUrl: roomImageUrl || option.alfaclubRoomImageUrl || null,
      // Keep creator-coin identity for list/holdings rows.
      name: option.name,
      logoUrl: option.logoUrl || shareTokenLogo(option.address, BASE_CHAIN_ID),
    })
  }

  const roomsById = new Map(
    (params.rooms ?? []).map((room) => [room.roomId, room] as const),
  )

  for (const pin of ALFACLUB_ROOM_TOKEN_PINS) {
    if (out.length >= limit) break
    const address = normalizeAddress(pin.address)
    if (!address) continue
    const match = params.tokenOptions.find(
      (option) => option.address.toLowerCase() === address,
    )
    const room = roomsById.get(pin.roomId)
    push(match ?? pinFallbackOption(pin), pin.roomId, room?.imageUrl)
  }

  const rankedRooms = [...(params.rooms ?? [])].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return (b.volumeUsdc ?? -1) - (a.volumeUsdc ?? -1)
  })

  for (const room of rankedRooms) {
    if (out.length >= limit) break
    const pin = ALFACLUB_ROOM_TOKEN_PINS.find((entry) => entry.roomId === room.roomId)
    if (pin) continue
    const matched = matchCreatorOptionByRoomName(room, params.tokenOptions)
    if (!matched) continue
    push(matched, room.roomId, room.imageUrl)
  }

  return out
}

/** Strip room-only presentation so holdings/list rows stay creator-coin identity. */
export function stripAlfaClubRoomPresentation(option: SwapTokenOption): SwapTokenOption {
  if (!option.alfaclubRoomId && !option.alfaclubRoomImageUrl) return option
  const { alfaclubRoomId: _roomId, alfaclubRoomImageUrl: _roomImage, ...rest } = option
  return rest
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
  if (!response.ok || !payload?.success || !Array.isArray(payload.data?.rows)) {
    return []
  }
  return payload.data.rows
}
