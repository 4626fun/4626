import type { VercelRequest, VercelResponse } from '@vercel/node'

import runtimeHandler from '../../_webhook.runtime.js'
import type { TelegramWebhookConfig } from '../config.js'
import type { TelegramUpdate } from '../types.js'
import type { TelegramPreCheckoutQuery, TelegramWebhookOk } from '../types.js'
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
