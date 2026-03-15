import type { VercelRequest, VercelResponse } from '@vercel/node'

import runtimeHandler from '../../_webhook.runtime.js'
import type { TelegramWebhookConfig } from '../config.js'
import type { TelegramUpdate } from '../types.js'
import type { TelegramMessage, TelegramSuccessfulPayment, TelegramWebhookOk } from '../types.js'
import { asTrimmed, isAddressLike, parseOptionalPositiveInteger } from '../utils.js'

export async function handle(
  req: VercelRequest,
  res: VercelResponse,
  update: TelegramUpdate,
  _config: TelegramWebhookConfig,
) {
  ;(req as any).body = update
  return runtimeHandler(req, res)
}

export async function handleSuccessfulPaymentUpdate(params: {
  updateId?: number
  message: TelegramMessage | null | undefined
  successfulPayment: TelegramSuccessfulPayment | null | undefined
  parseTipInvoicePayload: (payload: unknown) => { stars: number; context: string } | null
  isStarsTipsEnabledForChat: (chatId: string) => boolean
  getDb: () => Promise<any>
  getTelegramLinkByUserId: (args: { db: any; telegramUserId: string }) => Promise<any>
  logTelegramActionAudit: (args: any) => Promise<unknown>
  sendTelegramMessage: (args: {
    botToken: string
    chatId: string
    text: string
    replyToMessageId?: number
    replyMarkup?: Record<string, unknown>
  }) => Promise<void>
  botToken: string
  onMessageError?: (error: unknown, meta: { updateId: number | null; chatId: string }) => void
}): Promise<TelegramWebhookOk | null> {
  const paymentMessage = params.message
  const successfulPayment = params.successfulPayment
  if (!paymentMessage || !successfulPayment || typeof successfulPayment !== 'object') return null

  const paymentChatId = String(paymentMessage.chat?.id ?? '').trim()
  const paymentUserId = String(paymentMessage.from?.id ?? '').trim()
  const paymentMessageId = typeof paymentMessage.message_id === 'number' ? paymentMessage.message_id : undefined
  const tipPayload = params.parseTipInvoicePayload(successfulPayment.invoice_payload)
  const paymentCurrency = asTrimmed(successfulPayment.currency ?? '').toUpperCase()
  if (paymentChatId && tipPayload && paymentCurrency === 'XTR' && params.isStarsTipsEnabledForChat(paymentChatId)) {
    const db = await params.getDb()
    if (db && paymentUserId) {
      const link = await params.getTelegramLinkByUserId({ db, telegramUserId: paymentUserId }).catch(() => null)
      if (link && link.profileId > 0 && isAddressLike(link.canonicalCswAddress)) {
        await params
          .logTelegramActionAudit({
            db,
            telegramUserId: paymentUserId,
            chatId: paymentChatId,
            messageId: paymentMessageId,
            profileId: link.profileId,
            canonicalCswAddress: link.canonicalCswAddress,
            actionType: 'tip',
            intent: {
              source: 'telegram_stars',
              stars: tipPayload.stars,
              context: tipPayload.context,
              invoicePayload: successfulPayment.invoice_payload,
            },
            quote: {
              currency: paymentCurrency,
              totalAmount: parseOptionalPositiveInteger(successfulPayment.total_amount),
            },
            execution: {
              telegramPaymentChargeId: asTrimmed(successfulPayment.telegram_payment_charge_id ?? ''),
              providerPaymentChargeId: asTrimmed(successfulPayment.provider_payment_charge_id ?? ''),
            },
            status: 'paid',
          })
          .catch(() => {})
      }
    }
    await params
      .sendTelegramMessage({
        botToken: params.botToken,
        chatId: paymentChatId,
        text: `Thanks for the tip! ${tipPayload.stars} ⭐ received.`,
        replyToMessageId: paymentMessageId,
      })
      .catch((error) => {
        params.onMessageError?.(error, {
          updateId: params.updateId ?? null,
          chatId: paymentChatId,
        })
      })
  }

  return { ok: true, updateId: params.updateId ?? null }
}
