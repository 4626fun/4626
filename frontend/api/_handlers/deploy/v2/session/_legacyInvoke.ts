import type { VercelRequest } from '@vercel/node'

import type { ApiHandler } from '../../../_routeLoader.js'

type LegacyInvokeResult<T = any> = {
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

function makeRequest(req: VercelRequest, body: unknown): VercelRequest {
  return {
    ...req,
    method: 'POST',
    body,
  } as VercelRequest
}

export async function invokeLegacyHandler<T = any>(params: {
  req: VercelRequest
  body: Record<string, unknown>
  handler: ApiHandler
}): Promise<LegacyInvokeResult<T>> {
  const mockReq = makeRequest(params.req, params.body)
  const mockRes = new MockVercelResponse() as any
  await params.handler(mockReq, mockRes)
  return {
    statusCode: mockRes.statusCode ?? 500,
    payload: (mockRes.payload ?? null) as T | null,
    headers: (mockRes.headers ?? {}) as Record<string, string | string[]>,
  }
}
