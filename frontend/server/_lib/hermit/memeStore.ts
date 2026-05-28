import type { HermitMeme } from './types.js'

declare const process: { env: Record<string, string | undefined> }

/** Rotate away from the last N picks so /gmeow does not spam the same GIF. */
const RECENT_MEME_IDS_MAX = 4
let recentMemeIds: string[] = []

const DEFAULT_MEMES: HermitMeme[] = [
  {
    id: 'akita-black-cat-1',
    url: 'https://media.tenor.com/l7VvM4YwU6oAAAAM/doge-cat.gif',
    caption: 'Akita + black cat energy — chaos approved.',
    tags: ['akita', 'cat', 'chaos'],
  },
  {
    id: 'wagmi-huddle-1',
    url: 'https://media.tenor.com/4mK7k8vF7nQAAAAM/stonks-meme.gif',
    caption: 'Group chat when the number goes up.',
    tags: ['wagmi', 'alpha', 'group'],
  },
  {
    id: 'gm-vault-1',
    url: 'https://media.tenor.com/2yQf2rN3M4AAAAAM/gm-good-morning.gif',
    caption: 'gm from the vault floor — coffee optional.',
    tags: ['gm', 'vault', 'daily'],
  },
  {
    id: 'catlaugh-1',
    url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    caption: 'Hermit heard a joke on-chain and lost it.',
    tags: ['laugh', 'cat', 'meme'],
  },
  {
    id: 'chart-pump-1',
    url: 'https://i.giphy.com/media/26BRvoeo0vC2jlvXy/giphy.gif',
    caption: 'Chart did a little dance — nobody panic.',
    tags: ['chart', 'pump', 'meme'],
  },
  {
    id: 'side-eye-1',
    url: 'https://i.giphy.com/media/ICOgnKacfY448/giphy.gif',
    caption: 'Side-eye because the bid was too low.',
    tags: ['cat', 'skeptic', 'meme'],
  },
  {
    id: 'celebrate-1',
    url: 'https://i.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    caption: 'Tiny win — still counts on Base.',
    tags: ['win', 'celebrate', 'wagmi'],
  },
  {
    id: 'think-1',
    url: 'https://i.giphy.com/media/mlvseq9vdhlba/giphy.gif',
    caption: 'Hermit calculating vibes per block.',
    tags: ['think', 'cat', 'meme'],
  },
]

/** Playful one-liners when Pinata is off — paired with rotating GIFs. */
const LOCAL_GMEOW_HOOKS: readonly string[] = [
  'vault floor said send it.',
  'hermit snack break — charts optional.',
  'if it pumps, no questions asked.',
  'soft paws, loud timeline.',
  'another day, another green candle prayer.',
  'the cave is loud and the bags are curious.',
  'touch grass? never heard of her.',
  'gm energy with extra side-eye.',
]

function normalizeTag(value: string): string {
  return value.trim().toLowerCase()
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseMemeLibraryFromEnv(): HermitMeme[] {
  const raw = asString(process.env.HERMIT_MEME_LIBRARY_JSON)
  if (!raw) return DEFAULT_MEMES

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_MEMES
    const out: HermitMeme[] = []
    for (const [idx, entry] of parsed.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const row = entry as Record<string, unknown>
      const url = asString(row.url)
      if (!url) continue
      const caption = asString(row.caption) || 'Hermit meme drop.'
      const tags = Array.isArray(row.tags)
        ? row.tags.map((t) => asString(t)).filter(Boolean).map(normalizeTag)
        : []
      out.push({
        id: asString(row.id) || `env-meme-${idx + 1}`,
        url,
        caption,
        tags,
      })
    }
    return out.length > 0 ? out : DEFAULT_MEMES
  } catch {
    return DEFAULT_MEMES
  }
}

export function listHermitMemes(): HermitMeme[] {
  return parseMemeLibraryFromEnv()
}

function rememberRecentMeme(id: string): void {
  recentMemeIds = [id, ...recentMemeIds.filter((x) => x !== id)].slice(0, RECENT_MEME_IDS_MAX)
}

/** Test-only: reset rotation memory between cases. */
export function resetHermitMemeRecentForTests(): void {
  recentMemeIds = []
}

export function pickRandomHermitMeme(tag?: string): HermitMeme {
  const pool = parseMemeLibraryFromEnv()
  const normalizedTag = normalizeTag(tag ?? '')
  const tagged = normalizedTag ? pool.filter((meme) => meme.tags.includes(normalizedTag)) : pool
  const source = tagged.length > 0 ? tagged : pool
  const fresh = source.filter((meme) => !recentMemeIds.includes(meme.id))
  const candidates = fresh.length > 0 ? fresh : source
  const index = Math.floor(Math.random() * candidates.length)
  const picked = candidates[index] ?? DEFAULT_MEMES[0]
  rememberRecentMeme(picked.id)
  return picked
}

/** Local creative line when Pinata is unavailable — not the same stock caption every drop. */
export function pickGmeowLocalLine(meme: HermitMeme): string {
  const tagHook = LOCAL_GMEOW_HOOKS.find((line) =>
    meme.tags.some((tag) => line.toLowerCase().includes(tag)),
  )
  if (tagHook && Math.random() < 0.35) return tagHook
  const idx = Math.floor(Math.random() * LOCAL_GMEOW_HOOKS.length)
  return LOCAL_GMEOW_HOOKS[idx] ?? meme.caption
}
