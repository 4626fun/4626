import type { VercelRequest, VercelResponse } from '@vercel/node'

import runtimeHandler from '../../_webhook.runtime.js'
import type { TelegramWebhookConfig } from '../config.js'
import type { TelegramChosenInlineResult, TelegramUpdate, TelegramWebhookOk } from '../types.js'
import { asTrimmed } from '../utils.js'

export async function handle(
  req: VercelRequest,
  res: VercelResponse,
  update: TelegramUpdate,
  _config: TelegramWebhookConfig,
) {
  ;(req as any).body = update
  return runtimeHandler(req, res)
}

export async function handleChosenInlineResultUpdate(params: {
  updateId?: number
  chosenInlineResult: TelegramChosenInlineResult | null | undefined
  onChosenInlineResult: (args: {
    resultId: string
    userId: string
    query: string
    inlineMessageId: string
  }) => Promise<void> | void
  onError?: (error: unknown, meta: { updateId: number | null; resultId: string }) => void
}): Promise<TelegramWebhookOk | null> {
  const chosenInlineResult = params.chosenInlineResult
  if (!chosenInlineResult || typeof chosenInlineResult !== 'object') return null

  const resultId = asTrimmed(chosenInlineResult.result_id ?? '')
  if (!resultId) {
    return { ok: true, ignored: true, updateId: params.updateId ?? null }
  }

  try {
    await params.onChosenInlineResult({
      resultId,
      userId: asTrimmed(chosenInlineResult.from?.id ?? ''),
      query: asTrimmed(chosenInlineResult.query ?? ''),
      inlineMessageId: asTrimmed(chosenInlineResult.inline_message_id ?? ''),
    })
  } catch (error) {
    params.onError?.(error, { updateId: params.updateId ?? null, resultId })
  }

  return { ok: true, updateId: params.updateId ?? null }
}
