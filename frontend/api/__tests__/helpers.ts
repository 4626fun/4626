import type { VercelRequest, VercelResponse } from '@vercel/node'
import { makeSessionToken } from '../../server/auth/_shared.ts'

type ReqOptions = {
  method?: string
  headers?: Record<string, string | undefined>
  body?: any
  query?: Record<string, any>
  rawBody?: string
  url?: string
}

type HeaderValue = string | string[]

export function createMockReq(options: ReqOptions = {}): VercelRequest {
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    if (typeof v === 'string') headers[k.toLowerCase()] = v
  }

  const req: any = {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
    query: options.query ?? {},
    url: options.url ?? '/api/test',
    [Symbol.asyncIterator]: async function* () {
      if (typeof options.rawBody === 'string') {
        yield Buffer.from(options.rawBody)
      }
    },
  }

  return req as VercelRequest
}

export function createMockRes(): VercelResponse & {
  statusCode: number
  body: any
  headersSent: boolean
  headerMap: Map<string, HeaderValue>
} {
  const headerMap = new Map<string, HeaderValue>()

  const res: any = {
    statusCode: 200,
    body: undefined,
    headersSent: false,
    headerMap,
    setHeader(name: string, value: HeaderValue) {
      headerMap.set(name.toLowerCase(), value)
      return this
    },
    getHeader(name: string) {
      return headerMap.get(name.toLowerCase())
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.body = payload
      this.headersSent = true
      return this
    },
    end(payload?: any) {
      this.body = payload
      this.headersSent = true
      return this
    },
    send(payload?: any) {
      this.body = payload
      this.headersSent = true
      return this
    },
  }

  return res
}

export function readSetCookies(res: ReturnType<typeof createMockRes>): string[] {
  const raw = res.getHeader('set-cookie')
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x))
  return [String(raw)]
}

export function applyEnv(overrides: Record<string, string | undefined>): () => void {
  const previous: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(overrides)) {
    previous[k] = process.env[k]
    if (typeof v === 'undefined') {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }

  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (typeof v === 'undefined') {
        delete process.env[k]
      } else {
        process.env[k] = v
      }
    }
  }
}

export function withAuthHeader(
  headers: Record<string, string | undefined> = {},
  address = '0x0000000000000000000000000000000000000001',
): Record<string, string | undefined> {
  const token = makeSessionToken({ address })
  return {
    ...headers,
    authorization: `Bearer ${token}`,
  }
}
