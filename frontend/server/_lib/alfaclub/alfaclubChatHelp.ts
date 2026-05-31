import { isHermitCommandRoom } from './chatBridge.js'
import { readOperationalAlfaClubRoomIds } from './creatorRoomLinks.js'
import { formatHermitCommandRoomHelp } from '../hermit/hermitAlfaClubHelp.js'

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
    '**/help** — this message',
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
