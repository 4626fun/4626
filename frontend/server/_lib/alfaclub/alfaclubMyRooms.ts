import type { Address } from 'viem'

import {
  getAlfaClubHoldings,
  getAlfaClubPublicClient,
  type AlfaClubHoldingsResult,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import { resolveAuthorizedWalletProfile } from '../wallet/canonicalWalletResolver.js'

type MyRoomsDependencies = {
  resolveCanonicalCsw?: (sessionAddress: string) => Promise<Address | null>
  getPublicClient?: () => Promise<AlfaClubPublicClientLike>
  getHoldings?: (
    address: Address,
    client: AlfaClubPublicClientLike,
  ) => Promise<AlfaClubHoldingsResult>
}

export async function resolveCanonicalCswForSession(
  sessionAddress: string,
): Promise<Address | null> {
  const authority = await resolveAuthorizedWalletProfile(sessionAddress)
  const canonical = authority?.canonicalSmartWalletAddress?.trim().toLowerCase() ?? ''
  return /^0x[a-f0-9]{40}$/.test(canonical) ? (canonical as Address) : null
}

export async function listMyAlfaClubRoomIds(
  sessionAddress: string,
  dependencies: MyRoomsDependencies = {},
): Promise<{ canonicalCswAddress: Address | null; roomIds: string[] }> {
  const resolveCanonicalCsw =
    dependencies.resolveCanonicalCsw ?? resolveCanonicalCswForSession
  const canonicalCswAddress = await resolveCanonicalCsw(sessionAddress)
  if (!canonicalCswAddress) return { canonicalCswAddress: null, roomIds: [] }

  const client = await (dependencies.getPublicClient ?? getAlfaClubPublicClient)()
  const holdings = await (dependencies.getHoldings ?? getAlfaClubHoldings)(
    canonicalCswAddress,
    client,
  )

  return {
    canonicalCswAddress,
    roomIds: holdings.holdings.map(({ tokenId }) => tokenId.toString()),
  }
}
