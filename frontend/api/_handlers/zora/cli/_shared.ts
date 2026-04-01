import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  requireServerKey,
  setCache,
  setCors,
} from '../../../../server/zora/_shared.js'
import { toCliErrorPayload } from '../../../../server/zora/cliCompat.js'

type CliErrorBody = { error: string; suggestion?: string }

export type CliParseResult<TParams> =
  | {
      ok: true
      params: TParams
    }
  | {
      ok: false
      status: number
      body: CliErrorBody
    }

type CliReadHandlerOptions<TParams, TResult> = {
  endpointPath: string
  cacheSeconds: number
  requireServerKey?: boolean
  parse: (req: VercelRequest) => CliParseResult<TParams>
  run: (context: { params: TParams; serverKey: string | null }) => Promise<TResult> | TResult
  fallbackSuggestion?: string
}

export function withCliReadHandler<TParams, TResult>(
  options: CliReadHandlerOptions<TParams, TResult>,
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    setCors(req, res)
    if (handleOptions(req, res)) return

    if (req.method !== 'GET') {
      return res.status(405).json({
        error: 'Method not allowed',
        suggestion: `Use GET ${options.endpointPath}.`,
      } satisfies CliErrorBody)
    }

    const needsServerKey = options.requireServerKey !== false
    const serverKey = needsServerKey ? requireServerKey() : null

    if (needsServerKey && !serverKey) {
      return res.status(501).json({
        error: 'ZORA_SERVER_API_KEY is not configured',
        suggestion: 'Set ZORA_SERVER_API_KEY in the server environment.',
      } satisfies CliErrorBody)
    }

    const parsed = options.parse(req)
    if (!parsed.ok) {
      return res.status(parsed.status).json(parsed.body)
    }

    try {
      const data = await options.run({
        params: parsed.params,
        serverKey,
      })
      setCache(res, options.cacheSeconds)
      return res.status(200).json(data)
    } catch (error) {
      const formatted = toCliErrorPayload(error, options.fallbackSuggestion)
      return res.status(formatted.status).json(formatted.body)
    }
  }
}

export function okParams<TParams>(params: TParams): CliParseResult<TParams> {
  return { ok: true, params }
}

export function parseError(
  status: number,
  error: string,
  suggestion?: string,
): CliParseResult<never> {
  return {
    ok: false,
    status,
    body: {
      error,
      ...(suggestion ? { suggestion } : {}),
    },
  }
}
