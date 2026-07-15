import type { VercelRequest } from '@vercel/node'

import type { ApiHandler } from '../../../_routeLoader.js'

type InvokeResult<T = any> = {
  statusCode: number
  payload: T | null
  headers: Record<string, string | string[]>
}

class MockVercelResponse {
  statusCode = 200
  payload: unknown = null
  headers: Record<string, string | string[]> = {}

  status(code: number): this {
    this.statusCode = code
    return this
  }

  setHeader(name: string, value: string | string[]): this {
    this.headers[name.toLowerCase()] = value
    return this
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()]
  }

  json(payload: unknown): this {
    this.payload = payload
    return this
  }

  end(payload?: unknown): this {
    if (payload !== undefined) this.payload = payload
    return this
  }
}

export async function invokeHandler<T = any>(params: {
  req: VercelRequest
  body: Record<string, unknown>
  handler: ApiHandler
}): Promise<InvokeResult<T>> {
  // Mutate the live request instead of object-spreading it. Vercel/Node request
  // headers (and other auth-bearing fields) are often non-enumerable, so
  // `{ ...req, body }` drops Authorization and continue/advance see
  // "Not authenticated" even when resume itself authenticated successfully.
  const previousMethod = params.req.method
  const previousBody = (params.req as { body?: unknown }).body
  params.req.method = 'POST'
  ;(params.req as { body?: unknown }).body = params.body
  const mockRes = new MockVercelResponse() as any
  try {
    await params.handler(params.req, mockRes)
  } finally {
    params.req.method = previousMethod
    ;(params.req as { body?: unknown }).body = previousBody
  }
  return {
    statusCode: mockRes.statusCode ?? 500,
    payload: (mockRes.payload ?? null) as T | null,
    headers: (mockRes.headers ?? {}) as Record<string, string | string[]>,
  }
}
