import type { VercelRequest } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

export function readCronSecretFromRequest(req: VercelRequest): string {
  const header = req.headers['x-cron-secret']
  if (Array.isArray(header)) return String(header[0] ?? '')
  if (typeof header === 'string' && header.trim().length > 0) return header.trim()

  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const match = auth.match(/^Bearer\s+(.+)$/i)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

export function readConfiguredCronSecret(): string {
  return (process.env.CRON_SECRET ?? '').trim()
}

export function isCronSecretAuthorized(req: VercelRequest): boolean {
  const configured = readConfiguredCronSecret()
  if (!configured) return false
  const provided = readCronSecretFromRequest(req)
  return Boolean(provided) && provided === configured
}
