import { encodeFunctionData, formatUnits, parseAbi, type Address } from 'viem'

import {
  getLatestSnapshotTs,
  getSnapshotAt,
  listRecentPublications,
  recentPublicationsForCreator,
  type MetricsSnapshotRow,
  type PublicationRecord,
} from '../../_lib/alfaclub/publicationLedger.js'
import { formatAlfaClubCommandHelp } from '../../_lib/alfaclub/alfaclubChatHelp.js'
import { formatAlfaClubStatusForChat } from '../../_lib/alfaclub/alfaclubChatStatus.js'
import { buildAlfaRoomChart } from '../../_lib/alfaclub/roomCharts.js'
import {
  buildAlfaClubBriefContext,
  formatAlfaClubDailyBrief,
  formatAlfaClubLeaderboardChat,
  readAlfaClubDailyBriefFlags,
  resolveAlfaClubBridgeRoomId,
  resolveDailyBriefRoomId,
  runAlfaClubDailyBrief,
} from '../../_lib/alfaclub/dailyBrief.js'
import {
  buildAlfaClubRoomUrl,
  resolveCreatorRoomLinks,
  resolveRoomIdFromFriendKeyTokenId,
} from '../../_lib/alfaclub/creatorRoomLinks.js'
import { SCORECARD_DISCLAIMER } from '../../_lib/alfaclub/scorecard.js'
import {
  readVigilanteFlags,
  type VigilanteFlags,
} from '../../_lib/alfaclub/vigilante.js'
import { assertTeeAttestationOrThrow } from '../../_lib/agent/teeAttestationGate.js'
import { logger } from '../../_lib/infra/logger.js'
import { ALFACLUB, FRIEND_KEY_ABI } from '../../_lib/wallet/alfaclub.js'
import {
  isExecutionReady,
  resolveCommandIssuerContextByAddress,
} from '@4626/server-core'
import type { CoinbaseSmartWalletCall } from '../../_lib/wallet/privyCoinbaseSmartWallet.js'
import { submitUserOpOrRefuse } from '../../_lib/wallet/userOperationSubmitter.js'
import { getBasePreflightPublicClient } from '../../_lib/wallet/walletBalancePreflight.js'
import type { KeeprCommandResult } from '../types.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const BPS_SCALE = 10_000n
const BUY_KEY_SLIPPAGE_BPS = 300n // 3%

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
])

type ReadContractClient = {
  readContract: (args: unknown) => Promise<unknown>
}

type CreateRoomType = 'trading' | 'social'

type ParsedCreateRoomPayload = {
  roomType: CreateRoomType
  roomTypeId: 0 | 1
  tier: 'casual' | 'club' | 'exclusive'
  tierId: 0 | 1 | 2
  additionalKeys: bigint
  metadata: string
  signature: `0x${string}`
}

function parseAddressFromText(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return match ? match[0].toLowerCase() : null
}

function shortAddress(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

function parsePositiveBigInt(raw: string | undefined): bigint | null {
  const normalized = String(raw ?? '').trim()
  if (!/^\d+$/.test(normalized)) return null
  try {
    const parsed = BigInt(normalized)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function parseNonNegativeBigInt(raw: string | undefined): bigint | null {
  const normalized = String(raw ?? '').trim()
  if (!/^\d+$/.test(normalized)) return null
  try {
    return BigInt(normalized)
  } catch {
    return null
  }
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  const formatted = formatUnits(amount, decimals)
  return formatted.replace(/\.?0+$/, '')
}

function parseRoomType(value: unknown): { type: CreateRoomType; id: 0 | 1 } | null {
  if (typeof value === 'number') {
    if (value === 0) return { type: 'trading', id: 0 }
    if (value === 1) return { type: 'social', id: 1 }
    return null
  }
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === '0' || normalized === 'trading') {
    return { type: 'trading', id: 0 }
  }
  if (normalized === '1' || normalized === 'social') {
    return { type: 'social', id: 1 }
  }
  return null
}

function parseRoomTier(value: unknown): {
  tier: 'casual' | 'club' | 'exclusive'
  id: 0 | 1 | 2
} | null {
  if (typeof value === 'number') {
    if (value === 0) return { tier: 'casual', id: 0 }
    if (value === 1) return { tier: 'club', id: 1 }
    if (value === 2) return { tier: 'exclusive', id: 2 }
    return null
  }
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === '0' || normalized === 'casual') {
    return { tier: 'casual', id: 0 }
  }
  if (normalized === '1' || normalized === 'club') {
    return { tier: 'club', id: 1 }
  }
  if (normalized === '2' || normalized === 'exclusive') {
    return { tier: 'exclusive', id: 2 }
  }
  return null
}

function decodePotentialBase64Json(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('{')) return trimmed
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim()
    if (decoded.startsWith('{')) return decoded
    return trimmed
  } catch {
    return trimmed
  }
}

function parseCreateRoomPayload(rawPayload: string): ParsedCreateRoomPayload | null {
  const jsonText = decodePotentialBase64Json(rawPayload)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }

  const roomTypeValue = parsed.roomType ?? parsed.room_type ?? parsed.type
  const tierValue = parsed.tier ?? parsed.roomTier ?? parsed.room_tier
  const additionalKeysValue =
    parsed.additionalKeys ?? parsed.additional_keys ?? parsed.keys ?? 0
  const metadataValue = parsed.metadata ?? parsed.uri ?? ''
  const signatureValue = parsed.signature ?? parsed.sig

  const roomTypeParsed = parseRoomType(roomTypeValue)
  const tierParsed = parseRoomTier(tierValue)
  const additionalKeys = parseNonNegativeBigInt(
    additionalKeysValue === undefined ? undefined : String(additionalKeysValue),
  )
  const metadata = typeof metadataValue === 'string' ? metadataValue : ''
  const signature = String(signatureValue ?? '').trim()

  if (!roomTypeParsed || !tierParsed || additionalKeys === null) return null
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) return null

  return {
    roomType: roomTypeParsed.type,
    roomTypeId: roomTypeParsed.id,
    tier: tierParsed.tier,
    tierId: tierParsed.id,
    additionalKeys,
    metadata,
    signature: signature as `0x${string}`,
  }
}

function stripAlfaClubCommandPrefix(text: string): { bridge: boolean; cleaned: string } {
  const trimmed = text.trim()
  if (/^\/bridge(?:\s|$)/i.test(trimmed)) {
    return { bridge: true, cleaned: trimmed.replace(/^\/bridge\s*/i, '').trim() }
  }
  return {
    bridge: false,
    cleaned: trimmed.replace(/^\/alfa(?:club)?\s*/i, '').trim(),
  }
}

function parseSubcommand(text: string): {
  sub:
    | 'leaderboard'
    | 'brief'
    | 'brief-post'
    | 'creator'
    | 'status'
    | 'help'
    | 'chart'
    | 'buy-key'
    | 'quote-key'
    | 'create-room'
  address: string | null
  tokenId: bigint | null
  amount: bigint | null
  payloadRaw: string | null
  chartKindRaw: string | null
  limit: number | null
} {
  const { bridge, cleaned } = stripAlfaClubCommandPrefix(text)
  if (!cleaned) {
    return {
      sub: bridge ? 'status' : 'leaderboard',
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }

  const parts = cleaned.split(/\s+/)
  const first = (parts[0] ?? '').toLowerCase()

  if (first === 'brief' || first === 'digest' || first === 'daily') {
    const second = (parts[1] ?? '').toLowerCase()
    const sub = second === 'post' || second === 'send' ? 'brief-post' : 'brief'
    return {
      sub,
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'leaderboard' || first === 'top' || first === 'ranking') {
    return {
      sub: 'leaderboard',
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'status' || first === 'flags' || first === 'health') {
    return {
      sub: 'status',
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'help' || first === '?') {
    return {
      sub: 'help',
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'chart' || first === 'charts') {
    const args = parts.slice(1)
    let kindRaw: string | null = null
    let limit: number | null = null
    for (const tokenRaw of args) {
      const token = tokenRaw.trim()
      if (!token) continue
      if (limit === null && /^\d+$/.test(token)) {
        limit = Number.parseInt(token, 10)
        continue
      }
      if (kindRaw === null) {
        kindRaw = token
      }
    }
    return {
      sub: 'chart',
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: kindRaw,
      limit,
    }
  }
  if (first === 'create-room' || first === 'createroom') {
    return {
      sub: 'create-room',
      address: null,
      tokenId: null,
      amount: null,
      payloadRaw: parts.slice(1).join(' ').trim() || null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'quote-key' || first === 'quotekey' || first === 'quote') {
    const tokenId = parsePositiveBigInt(parts[1])
    const amount = parts[2] ? parsePositiveBigInt(parts[2]) : 1n
    return {
      sub: 'quote-key',
      address: null,
      tokenId,
      amount,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'buy-key' || first === 'buykey' || first === 'buy') {
    const tokenId = parsePositiveBigInt(parts[1])
    const amount = parts[2] ? parsePositiveBigInt(parts[2]) : 1n
    return {
      sub: 'buy-key',
      address: null,
      tokenId,
      amount,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  if (first === 'creator' || first === 'wallet' || first === 'addr') {
    return {
      sub: 'creator',
      address: parseAddressFromText(parts.slice(1).join(' ')),
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }
  const addr = parseAddressFromText(cleaned)
  if (addr) {
    return {
      sub: 'creator',
      address: addr,
      tokenId: null,
      amount: null,
      payloadRaw: null,
      chartKindRaw: null,
      limit: null,
    }
  }

  return {
    sub: 'help',
    address: null,
    tokenId: null,
    amount: null,
    payloadRaw: null,
    chartKindRaw: null,
    limit: null,
  }
}

function formatFlagsLine(flags: VigilanteFlags): string {
  const bits: string[] = []
  if (flags.killSwitch) bits.push('kill-switch ON')
  bits.push(flags.readEnabled ? 'read=on' : 'read=off')
  bits.push(flags.postEnabled ? 'post=on' : 'post=off')
  bits.push(flags.feedbackEnabled ? 'feedback=on' : 'feedback=off')
  bits.push(`topN=${flags.topN}`)
  bits.push(`cooldown=${flags.cooldownHours}h`)
  return bits.join(' · ')
}

function formatHelp(): string {
  return `${formatAlfaClubCommandHelp()}\n\n${SCORECARD_DISCLAIMER}`
}

function formatLeaderboard(params: {
  flags: VigilanteFlags
  snapshotTs: string | null
  rows: MetricsSnapshotRow[]
  pubsByAddress: Map<string, PublicationRecord[]>
}): string {
  const { flags, snapshotTs, rows, pubsByAddress } = params
  const lines: string[] = ['**AlfaClub Integrity Leaderboard**']
  if (flags.killSwitch) {
    lines.push('Pipeline is in KILL_SWITCH state. No snapshot data will be returned.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!flags.readEnabled) {
    lines.push('Pipeline is dormant. `ALFACLUB_VIGILANTE_READ_ENABLED` is off.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!snapshotTs || rows.length === 0) {
    lines.push('No snapshot available yet. The daily cron populates this surface; expect the first run at 12:00 UTC.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }

  lines.push(`**Snapshot:** ${snapshotTs}`)
  lines.push(`**Flags:** ${formatFlagsLine(flags)}`)
  lines.push('')

  for (const row of rows.slice(0, flags.topN)) {
    const pubs = pubsByAddress.get(row.creatorAddress.toLowerCase()) ?? []
    const pub = pubs[0]
    const pubTag = pub
      ? pub.erc8004TxHash
        ? ` · erc8004:${pub.erc8004TxHash.slice(0, 10)}…`
        : pub.lensPostId
          ? ` · lens:${pub.lensPostId.slice(0, 10)}…`
          : ` · ${pub.kind}`
      : ''
    lines.push(
      `${String(row.rank).padStart(2, ' ')}. \`${shortAddress(row.creatorAddress)}\` #${row.tokenId.toString()} ` +
        `· supply=${row.totalSupply.toString()} · staked=${row.stakedSupply.toString()} ` +
        `· pnl30d=${formatUsd(row.pnl30dUsd ?? null)} · score=${row.score.toFixed(4)}${pubTag}`,
    )
  }

  lines.push('')
  lines.push(SCORECARD_DISCLAIMER)
  return lines.join('\n')
}

function formatCreatorDetail(params: {
  flags: VigilanteFlags
  snapshotTs: string | null
  address: string
  row: MetricsSnapshotRow | null
  publications: PublicationRecord[]
  roomUrl?: string | null
}): string {
  const { flags, snapshotTs, address, row, publications, roomUrl } = params
  const lines: string[] = [
    `**AlfaClub Creator** \`${address}\``,
    `**Flags:** ${formatFlagsLine(flags)}`,
  ]
  if (flags.killSwitch) {
    lines.push('Pipeline is in KILL_SWITCH state. No snapshot data will be returned.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!flags.readEnabled) {
    lines.push('Pipeline is dormant. `ALFACLUB_VIGILANTE_READ_ENABLED` is off.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  if (!snapshotTs) {
    lines.push('No snapshot available yet — the cron has not run.')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  lines.push(`**Snapshot:** ${snapshotTs}`)
  if (!row) {
    lines.push('This address is not currently indexed as an AlfaClub creator (no FriendKey room minted to it).')
    lines.push('')
    lines.push(SCORECARD_DISCLAIMER)
    return lines.join('\n')
  }
  lines.push('')
  lines.push(`**Rank:** ${row.rank}`)
  lines.push(`**Room (FriendKey tokenId):** ${row.tokenId.toString()}`)
  if (roomUrl) {
    lines.push(`**AlfaClub room:** ${roomUrl}`)
  } else {
    const fallbackRoomId = resolveRoomIdFromFriendKeyTokenId(row.tokenId.toString())
    if (fallbackRoomId) {
      lines.push(`**AlfaClub room (token match):** ${buildAlfaClubRoomUrl(fallbackRoomId)}`)
    }
  }
  lines.push(`**Supply:** ${row.totalSupply.toString()} (staked ${row.stakedSupply.toString()})`)
  lines.push(
    `**Hyperliquid:** account=${formatUsd(row.hlAccountValueUsd ?? null)} · pnl30d=${formatUsd(row.pnl30dUsd ?? null)}`,
  )
  lines.push(`**Composite score:** ${row.score.toFixed(4)}`)

  if (publications.length > 0) {
    lines.push('')
    lines.push('**Recent publications:**')
    for (const p of publications.slice(0, 3)) {
      const tag =
        p.erc8004TxHash
          ? `erc8004:${p.erc8004TxHash.slice(0, 14)}…`
          : p.lensPostId
            ? `lens:${p.lensPostId.slice(0, 14)}…`
            : p.scorecardUri
              ? `scorecard:${p.scorecardUri.slice(0, 20)}…`
              : p.kind
      lines.push(`  • [${p.kind}] ${p.createdAt} — ${tag}`)
    }
  }

  lines.push('')
  lines.push(SCORECARD_DISCLAIMER)
  return lines.join('\n')
}

async function loadLeaderboard(flags: VigilanteFlags): Promise<{
  snapshotTs: string | null
  rows: MetricsSnapshotRow[]
  pubsByAddress: Map<string, PublicationRecord[]>
}> {
  if (!flags.readEnabled) {
    return { snapshotTs: null, rows: [], pubsByAddress: new Map() }
  }
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return { snapshotTs: null, rows: [], pubsByAddress: new Map() }
  }
  const [rows, pubs] = await Promise.all([
    getSnapshotAt(snapshotTs),
    listRecentPublications(null, 200),
  ])
  const pubsByAddress = new Map<string, PublicationRecord[]>()
  for (const p of pubs) {
    const key = p.creatorAddress.toLowerCase()
    const list = pubsByAddress.get(key) ?? []
    list.push(p)
    pubsByAddress.set(key, list)
  }
  return { snapshotTs, rows, pubsByAddress }
}

async function loadCreator(
  flags: VigilanteFlags,
  address: string,
): Promise<{
  snapshotTs: string | null
  row: MetricsSnapshotRow | null
  publications: PublicationRecord[]
}> {
  if (!flags.readEnabled) {
    return { snapshotTs: null, row: null, publications: [] }
  }
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return { snapshotTs: null, row: null, publications: [] }
  }
  const normalized = address.toLowerCase()
  const [rows, lensPubs, erc8004Pubs] = await Promise.all([
    getSnapshotAt(snapshotTs),
    recentPublicationsForCreator(normalized, 'lens', 5),
    recentPublicationsForCreator(normalized, 'erc8004-submitted', 5),
  ])
  const row = rows.find((r) => r.creatorAddress.toLowerCase() === normalized) ?? null
  const allPubs = [...lensPubs, ...erc8004Pubs].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )
  return { snapshotTs, row, publications: allPubs }
}

function formatExecutionReadinessRefusal(status: string, actionLabel: string): string {
  if (status === 'db_unavailable') {
    return `This ${actionLabel} can't be executed right now — account readiness storage is temporarily unavailable. Please try again shortly.`
  }
  if (status === 'revoked') {
    return `This ${actionLabel} can't be executed — your execution context has been revoked. Contact setup to restore access.`
  }
  return `This ${actionLabel} can't be executed — your account isn't provisioned for onchain execution yet. Contact setup to finish provisioning.`
}

async function executeQuoteKey(params: {
  tokenId: bigint | null
  amount: bigint | null
}): Promise<KeeprCommandResult> {
  if (!params.tokenId || !params.amount) {
    return {
      ok: false,
      response:
        'Usage: `/alfa quote-key <tokenId> [amount]`\nExample: `/alfa quote-key 42`',
    }
  }
  if (params.amount > 20n) {
    return {
      ok: false,
      response: 'Invalid amount. Keep `amount` between 1 and 20 for a single command.',
    }
  }

  const client = getBasePreflightPublicClient() as unknown as ReadContractClient

  let quotedCost = 0n
  let decimals = 6
  let symbol = 'USDC'

  try {
    const creator = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [params.tokenId],
    })) as Address
    if (creator.toLowerCase() === ZERO_ADDRESS) {
      return {
        ok: false,
        response: `Unknown room tokenId: ${params.tokenId.toString()}.`,
      }
    }

    quotedCost = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'getBuyPriceAfterFee',
      args: [params.tokenId, params.amount],
    })) as bigint
    if (quotedCost <= 0n) {
      return {
        ok: false,
        response: 'Quote returned zero cost. Try again or choose a different tokenId.',
      }
    }

    const bondingTokenRaw = await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'bondingToken',
    })
    if (
      typeof bondingTokenRaw === 'string' &&
      /^0x[a-fA-F0-9]{40}$/.test(bondingTokenRaw)
    ) {
      try {
        decimals = Number(
          (await client.readContract({
            address: bondingTokenRaw as Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })) as number,
        )
      } catch {
        decimals = 6
      }
      try {
        symbol = String(
          (await client.readContract({
            address: bondingTokenRaw as Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })) as string,
        )
      } catch {
        symbol = 'USDC'
      }
    }
  } catch (error) {
    logger.warn('[alfaclub/quote-key] quote read failed', {
      tokenId: params.tokenId.toString(),
      amount: params.amount.toString(),
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      response: 'Unable to quote room key purchase right now. Please retry in a moment.',
    }
  }

  const maxSpend = quotedCost + (quotedCost * BUY_KEY_SLIPPAGE_BPS) / BPS_SCALE
  const estimated = formatTokenAmount(quotedCost, decimals)
  const max = formatTokenAmount(maxSpend, decimals)

  return {
    ok: true,
    response: [
      'Room key quote',
      '',
      `- TokenId: ${params.tokenId.toString()}`,
      `- Amount: ${params.amount.toString()} key(s)`,
      `- Estimated cost: ${estimated} ${symbol}`,
      `- Suggested max spend: ${max} ${symbol} (3% slippage buffer)`,
      '',
      `To execute: \`/alfa buy-key ${params.tokenId.toString()} ${params.amount.toString()}\``,
    ].join('\n'),
  }
}

async function executeCreateRoom(params: {
  senderWallet: Address
  payloadRaw: string | null
}): Promise<KeeprCommandResult> {
  if (!params.payloadRaw) {
    return {
      ok: false,
      response: [
        'Usage: `/alfa create-room <json-or-base64>`',
        '',
        'Required payload fields:',
        '  - roomType: `trading` or `social`',
        '  - tier: `casual` | `club` | `exclusive` (or 0/1/2)',
        '  - additionalKeys: integer (usually 0)',
        '  - metadata: string',
        '  - signature: 0x...',
        '',
        'Example:',
        '  `/alfa create-room {"roomType":"social","tier":"club","additionalKeys":"0","metadata":"ipfs://...","signature":"0x..."}`',
      ].join('\n'),
    }
  }

  const payload = parseCreateRoomPayload(params.payloadRaw)
  if (!payload) {
    return {
      ok: false,
      response:
        'Invalid create-room payload. Provide valid JSON (or base64 JSON) with roomType, tier, additionalKeys, metadata, signature.',
    }
  }

  const resolution = await resolveCommandIssuerContextByAddress(params.senderWallet)
  if (!isExecutionReady(resolution)) {
    return {
      ok: false,
      response: formatExecutionReadinessRefusal(resolution.status, 'room creation'),
    }
  }
  const issuer = resolution.context

  if (issuer.subAccount) {
    return {
      ok: false,
      response:
        'Room creation currently requires direct canonical-CSW execution context. This account is configured for sub-account routing; use the AlfaClub app signing flow to create the room.',
    }
  }

  try {
    await assertTeeAttestationOrThrow({
      action: 'alfaclub.create_room',
      actorAddress: params.senderWallet,
      metadata: {
        roomType: payload.roomType,
        tier: payload.tier,
        additionalKeys: payload.additionalKeys.toString(),
      },
    })
  } catch (error) {
    logger.warn('[alfaclub/create-room] TEE attestation gate denied create', {
      senderWallet: params.senderWallet,
      roomType: payload.roomType,
      tier: payload.tier,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      response:
        'Room creation denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  const client = getBasePreflightPublicClient() as unknown as ReadContractClient
  try {
    const canRegister = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'canRegisterRoom',
      args: [issuer.smartWallet, payload.roomTypeId, payload.tierId],
    })) as boolean
    if (!canRegister) {
      return {
        ok: false,
        response:
          'Room creation blocked: this wallet cannot register that room type/tier right now (already used or not allowed).',
      }
    }
  } catch (error) {
    // Fail-open: onchain submission still provides authoritative revert reason.
    logger.warn('[alfaclub/create-room] canRegisterRoom preflight failed', {
      senderWallet: params.senderWallet,
      roomType: payload.roomType,
      tier: payload.tier,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const functionName =
    payload.roomType === 'social' ? 'registerSocialCreator' : 'registerCreator'
  const callData = encodeFunctionData({
    abi: FRIEND_KEY_ABI,
    functionName,
    args: [payload.tierId, payload.additionalKeys, payload.metadata, payload.signature],
  })
  const calls: CoinbaseSmartWalletCall[] = [
    {
      to: ALFACLUB.friendKey,
      value: 0n,
      data: callData,
    },
  ]

  const submission = await submitUserOpOrRefuse({
    issuer,
    calls,
    valueWei: 0n,
    correlationId: `alfaclub/create-room:${payload.roomType}:${payload.tier}`,
  })
  if (!submission.ok) return { ok: false, response: submission.response }

  return {
    ok: true,
    response: [
      'Room creation submitted',
      '',
      `- Type: ${payload.roomType}`,
      `- Tier: ${payload.tier}`,
      `- Additional keys: ${payload.additionalKeys.toString()}`,
      `- Tx: https://basescan.org/tx/${submission.txHash}`,
      `- Creator: ${submission.smartWallet} (your smart wallet)`,
    ].join('\n'),
    action: {
      action: 'alfaclub.room.created',
      roomType: payload.roomType,
      tier: payload.tier,
      additionalKeys: payload.additionalKeys.toString(),
      txHash: submission.txHash,
      userOpHash: submission.userOpHash,
      smartWallet: submission.smartWallet,
      routing: 'arch-b-userop',
    },
  }
}

async function executeBuyKey(params: {
  senderWallet: Address
  tokenId: bigint | null
  amount: bigint | null
}): Promise<KeeprCommandResult> {
  if (!params.tokenId || !params.amount) {
    return {
      ok: false,
      response:
        'Usage: `/alfa buy-key <tokenId> [amount]`\nExample: `/alfa buy-key 42`',
    }
  }
  if (params.amount > 20n) {
    return {
      ok: false,
      response: 'Invalid amount. Keep `amount` between 1 and 20 for a single command.',
    }
  }

  const resolution = await resolveCommandIssuerContextByAddress(params.senderWallet)
  if (!isExecutionReady(resolution)) {
    return { ok: false, response: formatExecutionReadinessRefusal(resolution.status, 'buy') }
  }
  const issuer = resolution.context

  try {
    await assertTeeAttestationOrThrow({
      action: 'alfaclub.buy_key',
      actorAddress: params.senderWallet,
      metadata: {
        tokenId: params.tokenId.toString(),
        amount: params.amount.toString(),
      },
    })
  } catch (error) {
    logger.warn('[alfaclub/buy-key] TEE attestation gate denied buy', {
      senderWallet: params.senderWallet,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      response:
        'Buy denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  const client = getBasePreflightPublicClient() as unknown as ReadContractClient

  let quotedCost = 0n
  let bondingToken = ZERO_ADDRESS as Address
  let decimals = 6
  let symbol = 'USDC'
  let allowance = 0n

  try {
    const creator = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [params.tokenId],
    })) as Address
    if (creator.toLowerCase() === ZERO_ADDRESS) {
      return {
        ok: false,
        response: `Unknown room tokenId: ${params.tokenId.toString()}.`,
      }
    }

    quotedCost = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'getBuyPriceAfterFee',
      args: [params.tokenId, params.amount],
    })) as bigint
    if (quotedCost <= 0n) {
      return {
        ok: false,
        response: 'Quote returned zero cost. Try again or choose a different tokenId.',
      }
    }

    const bondingTokenRaw = await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'bondingToken',
    })
    if (
      typeof bondingTokenRaw !== 'string' ||
      !/^0x[a-fA-F0-9]{40}$/.test(bondingTokenRaw)
    ) {
      return {
        ok: false,
        response: 'Unable to resolve AlfaClub bonding token address.',
      }
    }
    bondingToken = bondingTokenRaw as Address

    try {
      decimals = Number(
        (await client.readContract({
          address: bondingToken,
          abi: ERC20_ABI,
          functionName: 'decimals',
        })) as number,
      )
    } catch {
      decimals = 6
    }
    try {
      symbol = String(
        (await client.readContract({
          address: bondingToken,
          abi: ERC20_ABI,
          functionName: 'symbol',
        })) as string,
      )
    } catch {
      symbol = 'USDC'
    }

    const executionWallet = issuer.subAccount?.subAccountAddress ?? issuer.smartWallet
    allowance = (await client.readContract({
      address: bondingToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [executionWallet, ALFACLUB.friendKey],
    })) as bigint
  } catch (error) {
    logger.warn('[alfaclub/buy-key] quote/allowance read failed', {
      senderWallet: params.senderWallet,
      tokenId: params.tokenId.toString(),
      amount: params.amount.toString(),
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      response: 'Unable to quote room key purchase right now. Please retry in a moment.',
    }
  }

  const maxSpend = quotedCost + (quotedCost * BUY_KEY_SLIPPAGE_BPS) / BPS_SCALE
  const calls: CoinbaseSmartWalletCall[] = []
  const needsApproval = allowance < maxSpend
  if (needsApproval) {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ALFACLUB.friendKey, maxSpend],
    })
    calls.push({
      to: bondingToken,
      value: 0n,
      data: approveData,
    })
  }

  const buyData = encodeFunctionData({
    abi: FRIEND_KEY_ABI,
    functionName: 'buyShares',
    args: [params.tokenId, params.amount, maxSpend],
  })
  calls.push({
    to: ALFACLUB.friendKey,
    value: 0n,
    data: buyData,
  })

  const submission = await submitUserOpOrRefuse({
    issuer,
    calls,
    valueWei: 0n,
    correlationId: `alfaclub/buy-key:${params.tokenId.toString()}`,
  })
  if (!submission.ok) return { ok: false, response: submission.response }

  const estimated = formatTokenAmount(quotedCost, decimals)
  const max = formatTokenAmount(maxSpend, decimals)

  return {
    ok: true,
    response: [
      'Room key purchase submitted',
      '',
      `- TokenId: ${params.tokenId.toString()}`,
      `- Amount: ${params.amount.toString()} key(s)`,
      `- Estimated cost: ${estimated} ${symbol}`,
      `- Max spend: ${max} ${symbol} (3% slippage buffer)`,
      `- Approval: ${needsApproval ? 'included in this UserOp' : 'already approved'}`,
      `- Tx: https://basescan.org/tx/${submission.txHash}`,
      `- Buyer: ${submission.smartWallet} (your smart wallet)`,
    ].join('\n'),
    action: {
      action: 'alfaclub.key.bought',
      tokenId: params.tokenId.toString(),
      amount: params.amount.toString(),
      estimatedCost: quotedCost.toString(),
      maxSpend: maxSpend.toString(),
      symbol,
      txHash: submission.txHash,
      userOpHash: submission.userOpHash,
      smartWallet: submission.smartWallet,
      routing: 'arch-b-userop',
    },
  }
}

export async function executeAlfaclubCommandFamily(params: {
  text: string
  senderWallet: Address
}): Promise<KeeprCommandResult> {
  const parsed = parseSubcommand(params.text ?? '')
  const flags = readVigilanteFlags()

  if (parsed.sub === 'status') {
    const response = await formatAlfaClubStatusForChat(flags)
    return { ok: true, response: `${response}\n\n${SCORECARD_DISCLAIMER}` }
  }
  if (parsed.sub === 'quote-key') {
    return executeQuoteKey({
      tokenId: parsed.tokenId,
      amount: parsed.amount,
    })
  }
  if (parsed.sub === 'create-room') {
    return executeCreateRoom({
      senderWallet: params.senderWallet,
      payloadRaw: parsed.payloadRaw,
    })
  }
  if (parsed.sub === 'buy-key') {
    return executeBuyKey({
      senderWallet: params.senderWallet,
      tokenId: parsed.tokenId,
      amount: parsed.amount,
    })
  }
  if (parsed.sub === 'chart') {
    const chartResult = await buildAlfaRoomChart({
      kindRaw: parsed.chartKindRaw,
      limit: parsed.limit,
    })
    if (!chartResult.ok) {
      return { ok: false, response: chartResult.error }
    }
    return {
      ok: true,
      response: [
        `AlfaClub chart: ${chartResult.chart.title}`,
        '',
        chartResult.chart.summary,
      ].join('\n'),
      action: {
        action: 'alfaclub.message.attachments',
        kind: chartResult.chart.kind,
        attachments: [chartResult.chart.attachment],
      },
    }
  }
  if (parsed.sub === 'help') {
    return { ok: true, response: formatHelp() }
  }
  if (parsed.sub === 'brief') {
    const built = await buildAlfaClubBriefContext({ fetchMarkets: true })
    if (!built.ok) {
      const hint =
        built.reason === 'no_snapshot'
          ? 'No AlfaClub snapshot yet — run the snapshot cron first.'
          : 'Latest AlfaClub snapshot is empty.'
      return { ok: false, response: hint }
    }
    return { ok: true, response: formatAlfaClubDailyBrief(built.formatInput) }
  }
  if (parsed.sub === 'brief-post') {
    const briefRoomId = resolveDailyBriefRoomId()
    const result = await runAlfaClubDailyBrief({
      flags: { ...readAlfaClubDailyBriefFlags(), forceSend: true },
    })
    if (result.reason === 'brief_room_same_as_bridge') {
      return {
        ok: false,
        response: [
          'Daily digest is not posted into the command bridge room.',
          'Set `ALFACLUB_DAILY_BRIEF_ROOM_ID` to a read-only room and keep',
          '`ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE=1` on Vercel.',
          `Bridge room: ${resolveAlfaClubBridgeRoomId()}.`,
        ].join(' '),
      }
    }
    if (!result.ok || !result.sent) {
      const reason = result.reason ?? 'not_sent'
      return {
        ok: false,
        response: `Digest post failed (${reason}). Target room ${briefRoomId}.`,
      }
    }
    return {
      ok: true,
      response: `Daily digest posted to room **${briefRoomId}** (${result.lane ?? 'sent'}).`,
    }
  }
  if (parsed.sub === 'creator') {
    const address = parsed.address ?? params.senderWallet.toLowerCase()
    const loaded = await loadCreator(flags, address)
    let roomUrl: string | null = null
    if (loaded.row) {
      const roomIds = await resolveCreatorRoomLinks([
        { address: loaded.row.creatorAddress, tokenId: loaded.row.tokenId.toString() },
      ])
      const roomId = roomIds.get(address.toLowerCase())
      roomUrl = roomId ? buildAlfaClubRoomUrl(roomId) : null
    }
    return {
      ok: true,
      response: formatCreatorDetail({
        flags,
        snapshotTs: loaded.snapshotTs,
        address,
        row: loaded.row,
        publications: loaded.publications,
        roomUrl,
      }),
    }
  }

  const limit = parsed.limit ?? flags.topN
  const built = await buildAlfaClubBriefContext({
    topRows: limit,
    fetchMarkets: false,
    compact: true,
  })
  if (!built.ok) {
    const hint =
      built.reason === 'no_snapshot'
        ? 'No AlfaClub snapshot yet — the daily cron populates scores and room links.'
        : 'Latest AlfaClub snapshot is empty.'
    return { ok: false, response: hint }
  }
  return {
    ok: true,
    response: formatAlfaClubLeaderboardChat(built.formatInput, SCORECARD_DISCLAIMER),
  }
}
