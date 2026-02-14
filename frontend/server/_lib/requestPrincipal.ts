import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../auth/_shared.js'
import { readSiwaAgentFromRequest } from '../auth/_siwa.js'

export type RequestPrincipal = {
  source: 'session' | 'siwa'
  address: string
}

type ReadPrincipalOptions = {
  lowercase?: boolean
}

export function readRequestPrincipal(req: VercelRequest, opts: ReadPrincipalOptions = {}): RequestPrincipal | null {
  const lowercase = opts.lowercase !== false
  const normalize = (value: unknown): string => {
    const raw = typeof value === 'string' ? value.trim() : ''
    return lowercase ? raw.toLowerCase() : raw
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = normalize(session?.address)
  if (sessionAddress) {
    return { source: 'session', address: sessionAddress }
  }

  const siwa = readSiwaAgentFromRequest(req)
  const siwaAddress = normalize(siwa?.address)
  if (siwaAddress) {
    return { source: 'siwa', address: siwaAddress }
  }

  return null
}

export function readRequestPrincipalAddress(req: VercelRequest, opts: ReadPrincipalOptions = {}): string {
  return readRequestPrincipal(req, opts)?.address ?? ''
}
