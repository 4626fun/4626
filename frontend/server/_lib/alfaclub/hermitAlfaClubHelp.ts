/** Shared Hermit + AlfaClub help copy for `/help` and `/hermit help`. */

export const HERMIT_TONE_NAMES = [
  'clean',
  'degen',
  'pro',
  'poetic',
  'spanglish',
  'chaotic',
  'concise',
] as const

const ROOM_1659_ID = '1659'

function formatHermitCreativeSection(): string[] {
  return [
    '**Hermit — creative (read-only, no trades or wallet actions)**',
    '• `/gmeow [vibe]` — meme GIF + one-liner in chat (fastest demo)',
    '• `/meme <prompt>` — meme / image concept (+ attachment when generation is up)',
    '• `/hermit copy <idea>` — short post, CTA, and alternates',
    '• `/hermit announce <news>` — announcement-style room update',
    '• `/hermit quest <reward/task>` — quest or reward-drop copy',
    '• `/hermit tone <message>` — rewrite your message with sharper social tone',
    '• `/hermit help` — Hermit modes cheat sheet',
    '• `/hermit setup` — language, tone, and saved prefs for this room',
  ]
}

function formatHermitPersonalizationSection(): string[] {
  return [
    '**Hermit — your style (per room, per wallet)**',
    'Language / dialect — `/hermit lang <flag>` or drop a flag in any `/hermit`, `/meme`, `/gmeow` message:',
    '  🇲🇽 Mexican · 🇦🇷 Rioplatense · 🇨🇴 Colombian · 🇨🇱 Chilean · 🇵🇪 Peruvian · 🇻🇪 Venezuelan · 🇵🇷 Caribbean · 🇪🇸 European · 🌎 Neutral LATAM',
    `Tone — \`/hermit tone <name>\` where name is one of: ${HERMIT_TONE_NAMES.join(', ')}`,
    '  (Single-word tone = save default. Multi-word = rewrite that message.)',
    '• `/hermit prefs` — show what Hermit remembers for you here',
    '• `/hermit reset` — clear your Hermit preferences in this room',
  ]
}

function formatAlfaToolsSection(): string[] {
  return [
    '**AlfaClub tools (this room)**',
    '• `/alfa` — compact top-N leaderboard',
    '• `/alfa brief` — preview daily digest (chat only)',
    '• `/alfa brief post` — post digest to the configured brief room (ops)',
    '• `/alfa <address>` — one creator (score + room link when known)',
    '• `/alfa chart [kind] [limit]` — room analytics chart (IPFS image)',
    '  Chart kinds: `top-volume` · `tier-mix` · `pnl-distribution`',
    '• `/alfa status` · `/bridge status` — pipeline + bridge auth health',
    '• `/alfa quote-key` · `/alfa buy-key` · `/alfa create-room` — onchain room keys',
  ]
}

function formatCooldownSection(): string[] {
  return [
    '**Cooldowns**',
    '`/gmeow` ~5 min · `/meme` ~10 min per sender (when enabled) so chat does not flood.',
  ]
}

function formatRoomContextSection(roomId: string): string[] {
  if (roomId === ROOM_1659_ID) {
    return [
      '**Room 1659**',
      'Hermit drafts can include live market context here (Hyperliquid hype/liq, spot PnL, FriendKey curve) when you run `/hermit`, `/meme`, or `/gmeow`.',
    ]
  }
  return []
}

function formatRoomOrientationSection(roomId: string): string[] {
  return [
    '**Room map**',
    `You are in Hermit command room **${roomId}** — slash commands + creative drops, not a creator trading order book.`,
    'Creator trading rooms live at `alfaclub.app/room/{id}` (example: Flip Research token #2 → room **2**, not this ops surface).',
  ]
}

/** Full help body for Hermit command rooms (`ALFACLUB_HERMIT_COMMAND_ROOMS`). */
export function formatHermitCommandRoomHelp(roomId: string): string {
  const id = String(roomId ?? '').trim() || 'unknown'
  return [
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
    '**Examples**',
    '• `/gmeow stressed market`',
    '• `/meme akita doge black cat dark luxury`',
    '• `/hermit announce reward drop opens in 30 minutes`',
    '• `/hermit lang 🇲🇽` · `/hermit tone degen`',
    '',
    'Send `/help` anytime for this list.',
  ].join('\n')
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
    '• `/help` — full command list',
    '',
    `Room **${id}** · cooldowns apply on `/gmeow` and `/meme` so we do not flood chat.`,
  ].join('\n')
}
