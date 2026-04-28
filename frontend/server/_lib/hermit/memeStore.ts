import type { HermitMeme } from './types.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_MEMES: HermitMeme[] = [
  {
    id: 'akita-black-cat-1',
    url: 'https://media.tenor.com/l7VvM4YwU6oAAAAM/doge-cat.gif',
    caption: 'Akita + black cat energy.',
    tags: ['akita', 'cat', 'chaos'],
  },
  {
    id: 'wagmi-huddle-1',
    url: 'https://media.tenor.com/4mK7k8vF7nQAAAAM/stonks-meme.gif',
    caption: 'Group chat mood when bags go up.',
    tags: ['wagmi', 'alpha', 'group'],
  },
  {
    id: 'gm-vault-1',
    url: 'https://media.tenor.com/2yQf2rN3M4AAAAAM/gm-good-morning.gif',
    caption: 'gm from the vault floor.',
    tags: ['gm', 'vault', 'daily'],
  },
  {
    id: 'catlaugh-1',
    url: 'https://lime-rear-booby-542.mypinata.cloud/ipfs/bafybeiaj73ww23xkpuvrptykhu5ukcykd6w3fe5juc3zl6elzfz7tbj2jq?filename=catlaugh.gif',
    caption: 'cat laugh from the Hermit cave.',
    tags: ['laugh', 'cat', 'meme'],
  },
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

export function pickRandomHermitMeme(tag?: string): HermitMeme {
  const pool = parseMemeLibraryFromEnv()
  const normalizedTag = normalizeTag(tag ?? '')
  const filtered = normalizedTag
    ? pool.filter((meme) => meme.tags.includes(normalizedTag))
    : pool
  const source = filtered.length > 0 ? filtered : pool
  const index = Math.floor(Math.random() * source.length)
  return source[index] ?? DEFAULT_MEMES[0]
}
