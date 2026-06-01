import { isHermitCommandRoom } from './chatBridge.js'
import { readOperationalAlfaClubRoomIds } from './creatorRoomLinks.js'
import { formatHermitCommandRoomHelp } from '../hermit/hermitAlfaClubHelp.js'

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function normalizeWalletAddress(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim().toLowerCase()
  return EVM_ADDRESS_RE.test(value) ? value : null
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

export async function buildAlfaClubHelpResponse(params: {
  chatId?: string
  senderWallet?: string | null
}): Promise<string | null> {
  const roomId = parseAlfaClubRoomIdFromChatId(params.chatId)
  if (!roomId) return null

  if (isHermitCommandRoom(roomId)) {
    const wallet = normalizeWalletAddress(params.senderWallet)
    const positionBlock = wallet ? await resolveHermitHelpPositionBlock({ roomId, senderWallet: wallet }) : null
    return formatHermitCommandRoomHelp(roomId, { positionBlock })
  }

  if (isAlfaClubOpsRoomId(roomId)) return formatAlfaClubOpsRoomHelp(roomId)
  return null
}
