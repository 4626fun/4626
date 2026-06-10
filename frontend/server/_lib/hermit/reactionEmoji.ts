const KIND_TO_EMOJI: Readonly<Record<string, string>> = {
  gmeow: '😼',
  meme: '🖼️',
  hermit: '🦔',
}

const TAG_TO_EMOJI: Readonly<Record<string, string>> = {
  laugh: '😹',
  cat: '🐱',
  gm: '☀️',
  daily: '☀️',
  wagmi: '🚀',
  alpha: '🔥',
  pump: '📈',
  chart: '📊',
  chaos: '🌀',
  meme: '🐾',
  doge: '🐕',
  celebrate: '🎉',
  win: '🏆',
  think: '🤔',
  skeptic: '👀',
  vault: '🏦',
  group: '👥',
  akita: '🐕‍🦺',
}

const FALLBACK_EMOJI_POOL: readonly string[] = ['👍', '🔥', '😹', '✨', '🫡']

export function pickHermitReactionEmoji(params: {
  kind?: string | null
  tags?: readonly string[] | null
}): string {
  const kind = String(params.kind ?? '')
    .trim()
    .toLowerCase()
  if (kind && KIND_TO_EMOJI[kind]) return KIND_TO_EMOJI[kind]

  for (const raw of params.tags ?? []) {
    const tag = String(raw ?? '')
      .trim()
      .toLowerCase()
    if (!tag) continue
    const emoji = TAG_TO_EMOJI[tag]
    if (emoji) return emoji
  }

  const idx = Math.floor(Math.random() * FALLBACK_EMOJI_POOL.length)
  return FALLBACK_EMOJI_POOL[idx] ?? '👍'
}
