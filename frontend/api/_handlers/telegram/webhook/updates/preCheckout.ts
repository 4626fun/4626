import type { TelegramPreCheckoutQuery, TelegramWebhookOk } from '../types.js'
import { asTrimmed } from '../utils.js'

export async function handlePreCheckoutUpdate(params: {
  updateId?: number
  preCheckoutQuery: TelegramPreCheckoutQuery | null | undefined
  parseTipInvoicePayload: (payload: unknown) => { stars: number; context: string } | null
  areStarsTipsEnabled: () => boolean
  answerPreCheckoutQuery: (args: { botToken: string; preCheckoutQueryId: string; ok: boolean; errorMessage?: string }) => Promise<void>
  botToken: string
  onAnswerError?: (error: unknown, meta: { updateId: number | null; preCheckoutQueryId: string }) => void
}): Promise<TelegramWebhookOk | null> {
  const preCheckoutQuery = params.preCheckoutQuery
  if (!preCheckoutQuery || typeof preCheckoutQuery !== 'object') return null

  const preCheckoutQueryId = asTrimmed(preCheckoutQuery.id ?? '')
  const invoicePayload = params.parseTipInvoicePayload(preCheckoutQuery.invoice_payload)
  const preCheckoutCurrency = asTrimmed(preCheckoutQuery.currency ?? '').toUpperCase()
  const canProceed = params.areStarsTipsEnabled() && preCheckoutCurrency === 'XTR' && !!invoicePayload

  if (preCheckoutQueryId) {
    await params
      .answerPreCheckoutQuery({
        botToken: params.botToken,
        preCheckoutQueryId,
        ok: canProceed,
        errorMessage: canProceed ? undefined : 'Tip could not be validated. Please try again.',
      })
      .catch((error) => {
        params.onAnswerError?.(error, {
          updateId: params.updateId ?? null,
          preCheckoutQueryId,
        })
      })
  }

  return { ok: true, updateId: params.updateId ?? null }
}
