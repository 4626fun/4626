import { getDb } from '../db/postgres.js'
import { getTelegramLinkByUserId } from '../messaging/telegramTrading.js'
import { readProfileWalletAuthority } from '../wallet/canonicalWalletResolver.js'
import { resolveRoomFriendKeyAccess } from './roomFriendKeyAccess.js'

export type ValidatedTelegramIssuer = {
  profileId: number
  canonicalIssuer: `0x${string}`
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(normalized) ? normalized as `0x${string}` : null
}

export async function validateTelegramAlfaClubIssuer(params: {
  roomId: string
  telegramUserId: string
}): Promise<ValidatedTelegramIssuer | null> {
  const roomId = String(params.roomId ?? '').trim()
  const telegramUserId = String(params.telegramUserId ?? '').trim()
  if (!roomId || !telegramUserId) return null

  try {
    const db = await getDb()
    if (!db) return null
    const link = await getTelegramLinkByUserId({ db, telegramUserId })
    const profileId = Number(link?.profileId ?? 0)
    const linkedCanonical = normalizeAddress(link?.canonicalCswAddress)
    if (
      !link
      || !Number.isSafeInteger(profileId)
      || profileId <= 0
      || link.linkStatus !== 'active'
      || link.revokedAt !== null
      || !linkedCanonical
    ) {
      return null
    }

    const authority = await readProfileWalletAuthority({ db, profileId })
    const profileCanonical = normalizeAddress(authority?.canonicalSmartWalletAddress)
    if (
      !authority
      || authority.profileId !== profileId
      || !profileCanonical
      || profileCanonical !== linkedCanonical
    ) {
      return null
    }

    // Write stays FriendKey-only — coin-equivalent active membership is read-only.
    const owner = normalizeAddress(authority.activeOwnerWalletAddress)
    const friendKeyWallets: `0x${string}`[] = [profileCanonical]
    if (owner && owner !== profileCanonical) friendKeyWallets.push(owner)
    const friendKey = await resolveRoomFriendKeyAccess({
      roomId,
      wallets: friendKeyWallets,
      tokenIdHint: roomId,
    }).catch(() => null)
    if (!friendKey?.allowed) return null

    return { profileId, canonicalIssuer: profileCanonical }
  } catch {
    return null
  }
}
