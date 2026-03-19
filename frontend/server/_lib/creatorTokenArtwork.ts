export type CreatorTokenArtwork = {
  artworkUrl: string
  heroCutoutArtworkUrl?: string
}

function readPath(input: unknown, path: string[]): unknown {
  let current: unknown = input
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const str = asNonEmptyString(value)
    if (str) return str
  }
  return null
}

function readAttributeUrl(attributes: unknown, keys: string[]): string | null {
  if (!Array.isArray(attributes)) return null
  const normalizedKeys = keys.map((key) => key.toLowerCase())
  for (const entry of attributes) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const label = firstNonEmptyString(
      record.trait_type,
      record.traitType,
      record.key,
      record.name,
    )?.toLowerCase()
    if (!label || !normalizedKeys.includes(label)) continue
    const value = asNonEmptyString(record.value)
    if (value) return value
  }
  return null
}

const HERO_CUTOUT_ATTRIBUTE_KEYS = [
  'heroCutoutArtworkUrl',
  'hero_cutout_artwork_url',
  'heroCutoutUrl',
  'hero_cutout_url',
]

const ARTWORK_ATTRIBUTE_KEYS = [
  'artworkUrl',
  'artwork_url',
]

export function resolveCreatorTokenArtwork(coinData: unknown): CreatorTokenArtwork | null {
  if (!coinData || typeof coinData !== 'object') return null
  const artworkUrl = firstNonEmptyString(
    readPath(coinData, ['mediaContent', 'previewImage', 'medium']),
    readPath(coinData, ['mediaContent', 'previewImage', 'small']),
    readPath(coinData, ['mediaContent', 'originalUri']),
    readPath(coinData, ['artworkUrl']),
    readPath(coinData, ['metadata', 'properties', 'artworkUrl']),
    readPath(coinData, ['metadata', 'image']),
    readPath(coinData, ['extensions', 'artwork', 'artworkUrl']),
    readAttributeUrl(readPath(coinData, ['metadata', 'attributes']), ARTWORK_ATTRIBUTE_KEYS),
  )
  if (!artworkUrl) return null

  const heroCutoutArtworkUrl = firstNonEmptyString(
    readPath(coinData, ['heroCutoutArtworkUrl']),
    readPath(coinData, ['mediaContent', 'heroCutoutArtworkUrl']),
    readPath(coinData, ['mediaContent', 'heroCutout', 'originalUri']),
    readPath(coinData, ['metadata', 'heroCutoutArtworkUrl']),
    readPath(coinData, ['metadata', 'properties', 'heroCutoutArtworkUrl']),
    readPath(coinData, ['metadata', 'properties', 'hero_cutout_artwork_url']),
    readPath(coinData, ['extensions', 'artwork', 'heroCutoutArtworkUrl']),
    readPath(coinData, ['artwork', 'heroCutoutArtworkUrl']),
    readAttributeUrl(readPath(coinData, ['metadata', 'attributes']), HERO_CUTOUT_ATTRIBUTE_KEYS),
  )

  if (heroCutoutArtworkUrl && heroCutoutArtworkUrl !== artworkUrl) {
    return {
      artworkUrl,
      heroCutoutArtworkUrl,
    }
  }

  return { artworkUrl }
}
