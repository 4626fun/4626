import { createPrivateKey, createSign, randomUUID } from 'crypto'

type JsonObject = Record<string, unknown>

const CDP_API_HOST = 'api.cdp.coinbase.com'
const CDP_API_BASE = `https://${CDP_API_HOST}`

function toCleanErrorMessage(value: unknown, fallback = 'CDP swap request failed'): string {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 400)
  if (value && typeof value === 'object') {
    const maybe = value as Record<string, unknown>
    for (const field of ['message', 'error', 'detail']) {
      const candidate = maybe[field]
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 400)
    }
  }
  return fallback
}

function getCdpApiCredentials():
  | { ok: true; keyId: string; keySecret: string }
  | { ok: false; status: number; payload: JsonObject } {
  const keyId = String(process.env.CDP_API_KEY_ID ?? '').trim()
  const keySecret = String(process.env.CDP_API_KEY_SECRET ?? '').trim()
  if (!keyId || !keySecret) {
    return {
      ok: false,
      status: 503,
      payload: { success: false, error: 'CDP_API_KEY_ID / CDP_API_KEY_SECRET are not configured' },
    }
  }
  return { ok: true, keyId, keySecret }
}

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function normalizePemKey(value: string): string {
  let normalized = String(value ?? '').trim()
  if (!normalized) return normalized

  // Common env pitfall: whole PEM wrapped in quotes.
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }

  // Support secrets where newlines are escaped.
  normalized = normalized.replace(/\\n/g, '\n')

  // Some providers store the key as JSON payload:
  // {"privateKey":"-----BEGIN ...-----\\n..."}
  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    try {
      const parsed = JSON.parse(normalized) as Record<string, unknown>
      const candidate =
        (typeof parsed.privateKey === 'string' && parsed.privateKey) ||
        (typeof parsed.key === 'string' && parsed.key) ||
        (typeof parsed.secret === 'string' && parsed.secret) ||
        ''
      if (candidate) {
        normalized = candidate.trim().replace(/\\n/g, '\n')
      }
    } catch {
      // Keep original string and let parser throw below with a clearer message.
    }
  }

  if (normalized.includes('-----BEGIN')) return normalized

  // Fallback: key provided as base64-encoded PEM.
  const compact = normalized.replace(/\s+/g, '')
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length % 4 === 0) {
    try {
      const decoded = Buffer.from(compact, 'base64').toString('utf8').trim()
      if (decoded.includes('-----BEGIN')) return decoded
    } catch {
      // Ignore and return normalized below.
    }
  }

  return normalized
}

function derToJoseSignature(der: Buffer, expectedLength = 64): Buffer {
  // ASN.1 DER SEQUENCE { r INTEGER, s INTEGER } -> raw r||s for JWT ES256.
  if (der.length < 8 || der[0] !== 0x30) {
    throw new Error('Invalid DER signature format')
  }
  let offset = 2
  if (der[1] & 0x80) {
    const lengthBytes = der[1] & 0x7f
    offset = 2 + lengthBytes
  }
  if (der[offset] !== 0x02) throw new Error('Invalid DER signature: missing r integer')
  const rLength = der[offset + 1]
  const rStart = offset + 2
  const rEnd = rStart + rLength
  const r = der.subarray(rStart, rEnd)

  if (der[rEnd] !== 0x02) throw new Error('Invalid DER signature: missing s integer')
  const sLength = der[rEnd + 1]
  const sStart = rEnd + 2
  const sEnd = sStart + sLength
  const s = der.subarray(sStart, sEnd)

  const outputPartLength = expectedLength / 2
  const out = Buffer.alloc(expectedLength)
  const rSlice = r.length > outputPartLength ? r.subarray(r.length - outputPartLength) : r
  const sSlice = s.length > outputPartLength ? s.subarray(s.length - outputPartLength) : s
  rSlice.copy(out, outputPartLength - rSlice.length)
  sSlice.copy(out, expectedLength - sSlice.length)
  return out
}

async function buildCdpJwt(params: { keyId: string; keySecret: string; method: string; path: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'ES256',
    kid: params.keyId,
    typ: 'JWT',
  }
  const payload = {
    iss: 'cdp',
    sub: params.keyId,
    iat: now,
    exp: now + 120,
    nbf: now - 5,
    jti: randomUUID(),
    uri: `${params.method.toUpperCase()} ${CDP_API_HOST}${params.path}`,
  }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  let privateKey: ReturnType<typeof createPrivateKey>
  try {
    privateKey = createPrivateKey(normalizePemKey(params.keySecret))
  } catch (error) {
    throw new Error(
      `Failed to parse CDP_API_KEY_SECRET as an EC private key (${toCleanErrorMessage(
        error,
        'invalid key format',
      )}). Expected PEM with BEGIN/END lines or escaped newlines.`,
    )
  }
  const signer = createSign('SHA256')
  signer.update(signingInput)
  signer.end()
  const signatureDer = signer.sign(privateKey)
  const signature = base64UrlEncode(derToJoseSignature(signatureDer))
  return `${signingInput}.${signature}`
}

export async function cdpTradeFetch(params: {
  path: string
  method: 'POST'
  body?: JsonObject
  timeoutMs?: number
}): Promise<{ status: number; payload: unknown }> {
  const creds = getCdpApiCredentials()
  if (!creds.ok) {
    return {
      status: creds.status,
      payload: creds.payload,
    }
  }

  const path = params.path.startsWith('/') ? params.path : `/${params.path}`
  const url = `${CDP_API_BASE}${path}`
  let jwt = ''
  try {
    jwt = await buildCdpJwt({
      keyId: creds.keyId,
      keySecret: creds.keySecret,
      method: params.method,
      path,
    })
  } catch (error) {
    return {
      status: 500,
      payload: {
        success: false,
        error: toCleanErrorMessage(error, 'Failed to sign CDP API JWT'),
      },
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Number(params.timeoutMs ?? 20_000)))
    const res = await fetch(url, {
      method: params.method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params.body ?? {}),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const raw = await res.text()
    let payload: unknown = null
    try {
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = { message: raw || '' }
    }

    return { status: res.status, payload }
  } catch (error: any) {
    const isTimeout = String(error?.name ?? '').toLowerCase() === 'aborterror'
    return {
      status: isTimeout ? 504 : 502,
      payload: {
        success: false,
        error: isTimeout
          ? 'CDP swap request timed out. Please retry.'
          : toCleanErrorMessage(error?.message, 'CDP swap API unreachable'),
      },
    }
  }
}

export function normalizeCdpSwapPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const root = raw as Record<string, unknown>
  const candidate =
    (root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : null) ??
    (root.result && typeof root.result === 'object' ? (root.result as Record<string, unknown>) : null) ??
    root
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  return candidate as Record<string, unknown>
}
