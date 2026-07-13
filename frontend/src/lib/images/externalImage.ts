const EXTERNAL_IMAGE_PROXY_PATH = '/api/image/external'

export function proxiedExternalImageUrl(value: string | null | undefined): string | null {
  const source = value?.trim()
  if (!source) return null

  if (
    source.startsWith('/') ||
    source.startsWith('data:') ||
    source.startsWith('blob:')
  ) {
    return source
  }

  try {
    const parsed = new URL(source)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${EXTERNAL_IMAGE_PROXY_PATH}?url=${encodeURIComponent(parsed.toString())}`
  } catch {
    return null
  }
}
