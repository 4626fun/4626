declare const process: { env: Record<string, string | undefined> }

let warnedClientOnlyNeynarKey = false

type ReadNeynarApiKeyOptions = {
  context?: string
  warnIfClientOnly?: boolean
}

function contextSuffix(context?: string): string {
  return context ? ` (${context})` : ''
}

/**
 * Server-side Neynar API key reader.
 * - Only `NEYNAR_API_KEY` is considered valid for server auth.
 */
export function readNeynarApiKey(options: ReadNeynarApiKeyOptions = {}): string | null {
  const serverKey = String(process.env.NEYNAR_API_KEY ?? '').trim()
  const clientKey = String(process.env.VITE_NEYNAR_API_KEY ?? '').trim()
  const warnIfClientOnly = options.warnIfClientOnly !== false

  if (!serverKey && clientKey && warnIfClientOnly && !warnedClientOnlyNeynarKey) {
    warnedClientOnlyNeynarKey = true
    console.warn(
      `NEYNAR_API_KEY is missing${contextSuffix(options.context)}. VITE_NEYNAR_API_KEY is client-exposed and cannot be used for server verification.`,
    )
  }

  return serverKey || null
}

/**
 * Strict key reader for security-sensitive handlers.
 */
export function requireNeynarApiKey(options: ReadNeynarApiKeyOptions = {}): string {
  const key = readNeynarApiKey(options)
  if (!key) {
    throw new Error(`neynar_api_key_missing${contextSuffix(options.context)}`)
  }
  return key
}
