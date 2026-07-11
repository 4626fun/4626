export function toSafeHttpsUrl(
  raw: string | null | undefined,
  options: { allowedDomains?: readonly string[] } = {},
): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null

    const allowedDomains = options.allowedDomains ?? []
    if (
      allowedDomains.length > 0 &&
      !allowedDomains.some((domain) => {
        const normalized = domain.trim().toLowerCase()
        return normalized && (url.hostname === normalized || url.hostname.endsWith(`.${normalized}`))
      })
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}
