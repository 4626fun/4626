import type { TelegramChosenInlineResult, TelegramWebhookOk } from '../types.js'
import { asTrimmed } from '../utils.js'

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
      userId: String(chosenInlineResult.from?.id ?? '').trim(),
      query: asTrimmed(chosenInlineResult.query ?? ''),
      inlineMessageId: asTrimmed(chosenInlineResult.inline_message_id ?? ''),
    })
  } catch (error) {
    params.onError?.(error, { updateId: params.updateId ?? null, resultId })
  }

  return { ok: true, updateId: params.updateId ?? null }
}
