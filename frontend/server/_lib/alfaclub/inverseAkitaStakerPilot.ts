import type { Address } from 'viem'

import { getAlfaClubPublicClient } from '../wallet/alfaclub.js'
import { readUserStakedKeys, resolveStakingPoolAddress } from './alfaclubStakeReads.js'

export const INVERSE_AKITA_ROOM_ID = '1659'
export const MIN_INVERSE_AKITA_STAKER_PILOT_KEYS = 1

export type InverseAkitaStakerPilotReason =
  | 'operator'
  | 'staker'
  | 'insufficient_stake'
  | 'stake_read_failed'
  | 'wrong_room'

export type InverseAkitaStakerPilotAccess = {
  eligible: boolean
  stakedKeys: number | null
  reason: InverseAkitaStakerPilotReason
}

export function isInverseAkitaPilotRoom(roomId: string | null | undefined): boolean {
  return String(roomId ?? '').trim() === INVERSE_AKITA_ROOM_ID
}

function normalizePilotSender(value: string | null | undefined): Address | null {
  const trimmed = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? (trimmed as Address) : null
}

export async function resolveInverseAkitaStakerPilotAccess(params: {
  senderAddress: string
  roomId: string | null | undefined
  isTrustedOperator?: boolean
}): Promise<InverseAkitaStakerPilotAccess> {
  if (!isInverseAkitaPilotRoom(params.roomId)) {
    return { eligible: false, stakedKeys: null, reason: 'wrong_room' }
  }
  if (params.isTrustedOperator) {
    return { eligible: true, stakedKeys: null, reason: 'operator' }
  }

  const sender = normalizePilotSender(params.senderAddress)
  if (!sender) {
    return { eligible: false, stakedKeys: null, reason: 'stake_read_failed' }
  }

  try {
    const client = await getAlfaClubPublicClient()
    const tokenId = BigInt(INVERSE_AKITA_ROOM_ID)
    const stakingPool = await resolveStakingPoolAddress(client, tokenId)
    const stakedKeys = await readUserStakedKeys(client, stakingPool, sender, { tokenId })
    if (stakedKeys == null) {
      return { eligible: false, stakedKeys: null, reason: 'stake_read_failed' }
    }
    if (stakedKeys >= MIN_INVERSE_AKITA_STAKER_PILOT_KEYS) {
      return { eligible: true, stakedKeys, reason: 'staker' }
    }
    return { eligible: false, stakedKeys, reason: 'insufficient_stake' }
  } catch {
    return { eligible: false, stakedKeys: null, reason: 'stake_read_failed' }
  }
}

export function canPilotInverseAkita(params: {
  roomId: string | null | undefined
  isTrustedOperator: boolean
  pilotAccess: InverseAkitaStakerPilotAccess | null
}): boolean {
  if (!isInverseAkitaPilotRoom(params.roomId)) return params.isTrustedOperator
  return params.isTrustedOperator || params.pilotAccess?.eligible === true
}

export function formatInverseAkitaStakerPilotGateReply(): string {
  return [
    '**InverseAKITA pilot access**',
    `Stake at least **${MIN_INVERSE_AKITA_STAKER_PILOT_KEYS}** FriendKey in room **${INVERSE_AKITA_ROOM_ID}** to pilot InverseAKITA.`,
    '',
    'Mirrored counter-trading is retired here. InverseAKITA trades autonomously; stakers open, adjust, and close on **InverseAKITA\'s wallet**.',
    '',
    'Once staked: `/h arena long|short|close` · `/h pos` · `/h rules` · `/signal`',
    'Playbook tune (stakers): `/h mirror` · `/h profit` · `/h risk` · `/h size` · `/h strategy bias`',
  ].join('\n')
}

export function formatInverseAkitaPilotStatus(params: {
  pilotAccess: InverseAkitaStakerPilotAccess
  arenaAgentId?: string | null
  arenaWalletAddress?: string | null
}): string {
  const stakeLine =
    params.pilotAccess.stakedKeys == null
      ? 'Staked keys: unavailable (RPC read failed).'
      : `Staked keys: **${params.pilotAccess.stakedKeys}**`
  const accessLine =
    params.pilotAccess.eligible
      ? 'Pilot access: **enabled** — commands route to InverseAKITA\'s room-default wallet.'
      : params.pilotAccess.reason === 'insufficient_stake'
        ? `Pilot access: **locked** — stake ≥${MIN_INVERSE_AKITA_STAKER_PILOT_KEYS} key to unlock.`
        : 'Pilot access: **locked** — stake check failed; retry in a moment.'

  return [
    '**InverseAKITA (room 1659)**',
    'Autonomous agent strategy runs on its own wallet. Stakers with ≥1 staked key pilot the same controls as operators.',
    '',
    accessLine,
    stakeLine,
    '',
    '**Quick actions**',
    '• `/h arena long|short|close` — trade InverseAKITA wallet',
    '• `/h pos` · `/h arena status` — book + executor health',
    '• `/h rules` — full pilot guide',
    '• `/signal` — position-aware bias',
    '',
    `Executor: agent **${params.arenaAgentId ?? 'n/a'}** · wallet **${params.arenaWalletAddress ?? 'n/a'}**`,
  ].join('\n')
}
