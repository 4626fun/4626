import type { Address } from 'viem'

import { getAlfaClubPublicClient } from '../wallet/alfaclub.js'
import { readUserStakedKeys, resolveStakingPoolAddress } from './alfaclubStakeReads.js'
import type { CounterTradeBias, CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import { formatSizeCapForMembers } from './counterTradeSizing.js'

export const INVERSE_AKITA_ROOM_ID = '1659'
export const MIN_INVERSE_AKITA_STAKER_PILOT_KEYS = 1
export const INVERSE_AKITA_PILOT_RULES_MAX_CHARS = 2_000

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
    '**InverseAKITA pilot** — stake **≥1** FriendKey in this room to trade on InverseAKITA\'s wallet.',
    'Full guide: `/h rules` · Trade: `/h arena long|short|close` · Check: `/h status`',
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

function formatInverseAkitaPilotEligibilityLine(pilotAccess: InverseAkitaStakerPilotAccess): string {
  if (pilotAccess.reason === 'operator') {
    return '**You:** operator — pilot access on.'
  }
  if (pilotAccess.eligible && pilotAccess.reason === 'staker') {
    const keys = pilotAccess.stakedKeys ?? MIN_INVERSE_AKITA_STAKER_PILOT_KEYS
    return `**You:** pilot access on (**${keys}** staked key${keys === 1 ? '' : 's'}).`
  }
  if (pilotAccess.reason === 'insufficient_stake') {
    const keys = pilotAccess.stakedKeys ?? 0
    return `**You:** locked — stake **≥${MIN_INVERSE_AKITA_STAKER_PILOT_KEYS}** key (you have **${keys}**).`
  }
  return '**You:** stake check failed — try `/h status`.'
}

function formatInverseAkitaPilotPlaybookSummary(params: {
  runtime: CounterTradeRuntimeConfig
  globalBias: CounterTradeBias
}): string {
  const harvestTrimPct = Number.isFinite(params.runtime.harvestFraction)
    ? (params.runtime.harvestFraction * 100).toFixed(0)
    : '?'
  const defendCutPct = Number.isFinite(params.runtime.defendReduceFraction)
    ? (params.runtime.defendReduceFraction * 100).toFixed(0)
    : '?'

  return `Playbook: **${params.globalBias}** bias · bank at **+${params.runtime.harvestTriggerRoiPct}%** (trim **${harvestTrimPct}%**) · safety **${defendCutPct}%** within **${params.runtime.defendLiqDistancePct}%** of liq · cap ${formatSizeCapForMembers(params.runtime)}`
}

/** `/h rules` for room 1659 — short intro, access, commands, playbook snapshot. */
export function formatInverseAkitaPilotRules(params: {
  pilotAccess: InverseAkitaStakerPilotAccess
  runtime: CounterTradeRuntimeConfig
  globalBias?: CounterTradeBias
}): string {
  const globalBias = params.globalBias ?? 'neutral'
  const lines = [
    '**InverseAKITA**',
    'Autonomous Hyperliquid bot for this room. It trades on its own wallet; stakers with **≥1** FriendKey staked here can open/close on that same wallet.',
    'Drop any market take in chat — **long btc**, **eth looking cooked**, **sol gonna pump**, **should i short btc?** — and InverseAKITA does the **opposite** on its wallet lol.',
    '',
    formatInverseAkitaPilotEligibilityLine(params.pilotAccess),
    '',
    '**Trade** `/h arena long|short|close <pair> <usd> <lev>`',
    '**Check** `/h pos` · `/h status` · `/signal`',
    '**Tune** `/h mirror` · `/h profit` · `/h risk` · `/h size` · `/h strategy bias`',
    '',
    formatInverseAkitaPilotPlaybookSummary({ runtime: params.runtime, globalBias }),
  ]

  const text = lines.join('\n')
  if (text.length <= INVERSE_AKITA_PILOT_RULES_MAX_CHARS) return text
  return `${text.slice(0, INVERSE_AKITA_PILOT_RULES_MAX_CHARS - 1).trimEnd()}…`
}
