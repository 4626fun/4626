import { isHermitCommandRoom } from './chatBridge.js'
import { readOperationalAlfaClubRoomIds } from './creatorRoomLinks.js'
import { formatHermitCommandRoomHelp } from '../hermit/hermitAlfaClubHelp.js'

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const ALFACLUB_MESSAGE_MAX_CHARS = 2_000
const ALFACLUB_MESSAGE_SOFT_MAX_CHARS = 1_850

export type AlfaClubHelpPayload = {
  text: string
  followUpText?: string | null
}

function normalizeWalletAddress(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim().toLowerCase()
  return EVM_ADDRESS_RE.test(value) ? value : null
}

function splitForAlfaClubMessages(text: string): AlfaClubHelpPayload {
  if (text.length <= ALFACLUB_MESSAGE_MAX_CHARS) return { text }
  const paragraphs = text.split('\n\n')
  const primary: string[] = []
  let primaryLen = 0
  let idx = 0
  for (; idx < paragraphs.length; idx += 1) {
    const candidate = paragraphs[idx]
    const nextLen = primaryLen === 0 ? candidate.length : primaryLen + 2 + candidate.length
    if (nextLen > ALFACLUB_MESSAGE_SOFT_MAX_CHARS && primary.length > 0) break
    primary.push(candidate)
    primaryLen = nextLen
  }
  const secondary = paragraphs.slice(idx).join('\n\n').trim()
  if (!secondary) return { text: text.slice(0, ALFACLUB_MESSAGE_MAX_CHARS) }
  const followUpText =
    secondary.length <= ALFACLUB_MESSAGE_MAX_CHARS
      ? secondary
      : `${secondary.slice(0, ALFACLUB_MESSAGE_MAX_CHARS - 1).trimEnd()}…`
  return {
    text: primary.join('\n\n'),
    followUpText,
  }
}

function formatHermitConciseCtaSection(params: {
  roomId: string
  alertEnabled: boolean
  senderWallet: string
}): string[] {
  const lines = ['🎯 **Actionable next step (pick one)**']

  if (!params.alertEnabled) {
    lines.push('• Arm risk guardrails now: **`/hermit alert`**')
  } else {
    lines.push('• Confirm active protections: **`/hermit alert status`**')
  }

  lines.push('• Refresh risk + PnL snapshot: **`/position`**')

  if (params.roomId === '1659') {
    lines.push('• Check room execution lane: **`/arena status`** (or `/arena register` to create/bind an arena agent for this sender/room). /arena gated to allowlisted or HERMIT_OWNER_ADDRESS in AlfaClub rooms.')
  } else {
    lines.push('• Expand market context: **`/market`**')
  }

  const walletLabel = `${params.senderWallet.slice(0, 6)}…${params.senderWallet.slice(-4)}`
  lines.push('', `_${walletLabel} alerts are wallet-scoped (not room-key scoped)._`)
  return lines
}

async function buildHermitComprehensiveHelpPayload(params: {
  roomId: string
  senderWallet: string
}): Promise<AlfaClubHelpPayload> {
  const [
    { getClearinghouseState },
    { buildHyperliquidPositionReport },
    { readHyperliquidPositionAlert },
  ] = await Promise.all([
    import('./hyperliquid.js'),
    import('./positionReport.js'),
    import('./positionAlertStore.js'),
  ])

  // Room 1659 tracks a dedicated room-level Hyperliquid portfolio, not the
  // sender's personal wallet. Resolve the HL identity through the room
  // resolver so the snapshot/position report match the room context shown in
  // the "Market pulse" section below. Alert config stays per-sender.
  let hlWallet = params.senderWallet
  if (params.roomId === '1659') {
    const { resolveRoom1659HyperliquidUserForSnapshot } = await import('./room1659Market.js')
    hlWallet = resolveRoom1659HyperliquidUserForSnapshot(params.senderWallet)
  }

  const [stateResult, alertResult] = await Promise.allSettled([
    getClearinghouseState(hlWallet),
    readHyperliquidPositionAlert(params.senderWallet),
  ])
  const state = stateResult.status === 'fulfilled' ? stateResult.value : null
  const alert = alertResult.status === 'fulfilled' ? alertResult.value : null

  let room1659Market:
    | Awaited<ReturnType<(typeof import('./room1659Market.js'))['resolveRoom1659MarketContext']>>
    | null = null
  if (params.roomId === '1659') {
    try {
      const { resolveRoom1659MarketContext } = await import('./room1659Market.js')
      room1659Market = await resolveRoom1659MarketContext(params.senderWallet)
    } catch {
      room1659Market = null
    }
  }

  const sections: string[] = [
    '🧠 **Agent Hermit — Hyperliquid intelligence brief**',
    buildHyperliquidPositionReport({
      walletAddress: hlWallet,
      hlState: state,
      alert,
      roomId: params.roomId,
      room1659Market: room1659Market ?? undefined,
    }),
  ]

  if (stateResult.status === 'rejected' || alertResult.status === 'rejected') {
    sections.push(
      [
        '⚠️ **Data source note**',
        '- One or more upstream sources were unavailable this cycle.',
        '- Showing the best available snapshot; retry `/position` in a moment for full enrichment.',
      ].join('\n'),
    )
  }

  sections.push(
    formatHermitConciseCtaSection({
      roomId: params.roomId,
      alertEnabled: Boolean(alert?.enabled),
      senderWallet: params.senderWallet,
    }).join('\n'),
  )

  return splitForAlfaClubMessages(sections.join('\n\n'))
}

async function resolveHermitHelpPositionBlock(params: {
  roomId: string
  senderWallet: string
}): Promise<string> {
  if (params.roomId === '1659') {
    const { formatRoom1659PositionHelpBlock, resolveRoom1659MarketContext } = await import(
      './room1659Market.js'
    )
    const snapshot = await resolveRoom1659MarketContext(params.senderWallet)
    return formatRoom1659PositionHelpBlock(snapshot, params.senderWallet)
  }

  const { formatHyperliquidPositionHelpBlock, getClearinghouseState } = await import(
    './hyperliquid.js'
  )
  const state = await getClearinghouseState(params.senderWallet)
  return formatHyperliquidPositionHelpBlock(state, params.senderWallet)
}

export function parseAlfaClubRoomIdFromChatId(chatId: string | undefined): string | null {
  const trimmed = String(chatId ?? '').trim()
  if (!trimmed) return null
  const match = /^alfaclub:(.+)$/i.exec(trimmed)
  if (!match) return null
  const roomId = match[1].trim()
  if (!roomId || roomId.length > 128) return null
  return roomId
}

export function isAlfaClubOpsRoomId(roomId: string | undefined): boolean {
  const id = String(roomId ?? '').trim()
  if (!id) return false
  return readOperationalAlfaClubRoomIds().has(id)
}

/** Short help for bot/ops rooms (1043, bridge room, brief room). */
export function formatAlfaClubOpsRoomHelp(roomId: string): string {
  return [
    '**4626 bot room help**',
    `Room **${roomId}** = commands + daily digest (not a creator trading room).`,
    '',
    '**/alfa** — `/alfa` · `/alfa brief` · `/alfa brief post` (digest room) · `/alfa status`',
    '**/gmeow** · **/meme** — GIF in chat first, X link second when posted',
    '**/help** or **/halp** — your position + command list',
    '',
    'Creator rooms: `alfaclub.app/room/{id}` (their trading room — not this ops room).',
  ].join('\n')
}

export function formatAlfaClubCommandHelp(): string {
  return [
    '**/alfa** — AlfaClub leaderboard & room tools',
    '',
    '**Rooms**',
    '  Creator links → `alfaclub.app/room/{id}` (their trading room).',
    '  Bot/ops rooms (1043, 1659) = commands + digest when configured — not creator rooms.',
    '',
    '**Commands**',
    '  `/alfa` — compact top-N leaderboard',
    '  `/alfa brief` — preview digest (chat only)',
    '  `/alfa brief post` — post digest to every bot command room',
    '  `/alfa <address>` — one creator (score + room link when known)',
    '  `/alfa chart [kind] [limit]` — room analytics chart (IPFS image)',
    '  `/alfa status` or `/bridge status` — pipeline + bridge auth health',
    '  `/alfa quote-key` · `/alfa buy-key` · `/alfa create-room` — onchain room keys',
    '  `/arena status|register|identity ...|join|activate|...` — Arena controls (1659 + flags; supports per-sender "mine" bindings; gated to allowlist/owner in AlfaClub)',
    '',
    '**Hermit** (ops room): `/gmeow` · `/meme` — GIF in chat first, then X link when posted.',
    '',
    'Chart kinds: `top-volume` · `tier-mix` · `pnl-distribution`',
  ].join('\n')
}

export function resolveAlfaClubHelpText(chatId: string | undefined): string | null {
  const roomId = parseAlfaClubRoomIdFromChatId(chatId)
  if (!roomId) return null
  if (isHermitCommandRoom(roomId)) return formatHermitCommandRoomHelp(roomId)
  if (isAlfaClubOpsRoomId(roomId)) return formatAlfaClubOpsRoomHelp(roomId)
  return null
}

export async function buildAlfaClubHelpPayload(params: {
  chatId?: string
  senderWallet?: string | null
  comprehensive?: boolean
}): Promise<AlfaClubHelpPayload | null> {
  const roomId = parseAlfaClubRoomIdFromChatId(params.chatId)
  if (!roomId) return null

  if (isHermitCommandRoom(roomId)) {
    const wallet = normalizeWalletAddress(params.senderWallet)
    if (!wallet) {
      return {
        text: formatHermitCommandRoomHelp(roomId),
      }
    }
    if (params.comprehensive) {
      return buildHermitComprehensiveHelpPayload({ roomId, senderWallet: wallet })
    }
    const positionBlock = await resolveHermitHelpPositionBlock({ roomId, senderWallet: wallet })
    return { text: formatHermitCommandRoomHelp(roomId, { positionBlock }) }
  }

  if (isAlfaClubOpsRoomId(roomId)) return { text: formatAlfaClubOpsRoomHelp(roomId) }
  return null
}

export async function buildAlfaClubHelpResponse(params: {
  chatId?: string
  senderWallet?: string | null
}): Promise<string | null> {
  const payload = await buildAlfaClubHelpPayload(params)
  return payload?.text ?? null
}
