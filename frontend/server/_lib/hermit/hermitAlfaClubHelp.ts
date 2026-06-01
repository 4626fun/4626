/** Shared Hermit + AlfaClub help copy for `/help`, `/halp`, and `/hermit help`. */

export const HERMIT_TONE_NAMES = [
  'clean',
  'degen',
  'pro',
  'poetic',
  'spanglish',
  'chaotic',
  'concise',
] as const

/** AlfaClub bot sends truncate at 2_000 chars — keep help under this budget. */
export const HERMIT_COMMAND_ROOM_HELP_MAX_CHARS = 2_000

const ROOM_1659_ID = '1659'

export type HermitCommandRoomHelpOptions = {
  positionBlock?: string | null
}

function formatHermitCreativeSection(): string[] {
  return [
    '**Hermit — creative (read-only)**',
    '• `/position` — full HL + room 1659 snapshot + alert CTAs',
    '• `/gmeow [vibe]` — GIF + one-liner',
    '• `/meme <prompt>` — meme / image concept',
    '• `/hermit copy|announce|quest|tone <text>` — room copy drafts',
    '• `/hermit alert` — Telegram liquidation / target-gain alerts',
    '• `/hermit setup` · `/hermit help`',
  ]
}

function formatHermitCreativeSectionCompact(): string[] {
  return [
    '**Commands**',
    '• `/position` · `/gmeow` · `/meme` · `/hermit alert` · `/alfa brief`',
  ]
}

function formatHermitPersonalizationSection(): string[] {
  return [
    '**Hermit — your style (per room, per wallet)**',
    '• `/hermit lang <flag>` — 🇲🇽 🇦🇷 🇨🇴 🇨🇱 🇵🇪 🇻🇪 🇵🇷 🇪🇸 🌎 (or drop a flag in any Hermit message)',
    `• \`/hermit tone <name>\` — ${HERMIT_TONE_NAMES.join(', ')} (one word = save default; multi-word = rewrite)`,
    '• `/hermit prefs` · `/hermit reset`',
  ]
}

function formatAlfaToolsSection(): string[] {
  return [
    '**AlfaClub tools**',
    '• `/alfa` · `/alfa brief` · `/alfa brief post` · `/alfa <address>` · `/alfa chart [kind]`',
    '• `/alfa status` · `/bridge status` · `/alfa quote-key` · `/alfa buy-key` · `/alfa create-room`',
    '• Charts: `top-volume` · `tier-mix` · `pnl-distribution`',
  ]
}

function formatCooldownSection(): string[] {
  return ['**Cooldowns** — `/gmeow` ~5m · `/meme` ~10m per sender (when enabled).']
}

function formatRoomContextSection(roomId: string): string[] {
  if (roomId === ROOM_1659_ID) {
    return [
      '**Room 1659** — Hermit may inject live market context (Hyperliquid hype/liq, spot PnL, FriendKey curve).',
    ]
  }
  return []
}

function formatRoomOrientationSection(roomId: string): string[] {
  return [
    '**Room map**',
    `Hermit command room **${roomId}** — slash commands + creative drops, not a creator trading order book.`,
    'Creator rooms: `alfaclub.app/room/{id}` (example: Flip token #2 → room **2**).',
  ]
}

function trimHelpToBudget(text: string): string {
  if (text.length <= HERMIT_COMMAND_ROOM_HELP_MAX_CHARS) return text
  return `${text.slice(0, HERMIT_COMMAND_ROOM_HELP_MAX_CHARS - 1).trimEnd()}…`
}

/** Full help body for Hermit command rooms (`ALFACLUB_HERMIT_COMMAND_ROOMS`). */
export function formatHermitCommandRoomHelp(
  roomId: string,
  options?: HermitCommandRoomHelpOptions,
): string {
  const id = String(roomId ?? '').trim() || 'unknown'
  const positionBlock = options?.positionBlock?.trim() || null

  if (positionBlock) {
    const body = [
      '🐈‍⬛ **4626 / Agent Hermit**',
      '',
      positionBlock,
      '',
      ...formatHermitCreativeSectionCompact(),
      '',
      '• `/hermit prefs` · `/hermit tone` · `/position` · `/help` refreshes this snapshot',
      ...(id === ROOM_1659_ID
        ? ['', '_Room 1659 reads Hyperliquid + FriendKey for the wallet sending the command._']
        : []),
    ].join('\n')
    return trimHelpToBudget(body)
  }

  const body = [
    '🐈‍⬛ **4626 / Agent Hermit — room help**',
    '',
    ...formatRoomOrientationSection(id),
    '',
    ...formatHermitCreativeSection(),
    '',
    ...formatHermitPersonalizationSection(),
    '',
    ...formatAlfaToolsSection(),
    '',
    ...formatCooldownSection(),
    ...(formatRoomContextSection(id).length > 0 ? ['', ...formatRoomContextSection(id)] : []),
    '',
    '**Examples** — `/gmeow stressed market` · `/meme akita dark luxury` · `/hermit announce reward drop in 30m`',
    'Send `/help` or `/halp` anytime for this list.',
  ].join('\n')
  return trimHelpToBudget(body)
}

/** Short intro for ops scripts; points readers at `/help` for the full catalog. */
export function formatHermitRoomIntro(roomId: string): string {
  const id = String(roomId ?? '').trim() || 'unknown'
  return [
    '🐈‍⬛ **Agent Hermit** is live in this room.',
    '',
    'Creative bot for memes, GIF captions, and room copy — **read-only**, no trades or wallet actions.',
    '',
    'Try:',
    '• `/gmeow` — GIF + one-liner (fastest demo)',
    '• `/meme <prompt>` — meme / image idea',
    '• `/hermit copy <idea>` — short post + alternates',
    '• `/help` or `/halp` — your position + command list',
    '',
    `Room **${id}** · cooldowns apply on /gmeow and /meme so we do not flood chat.`,
  ].join('\n')
}
