import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'

import { getTelegramWebhookConfig, type TelegramWebhookConfig } from './webhook/config.js'
import type { TelegramWebhookOk, TelegramUpdate } from './webhook/types.js'

import * as messageHandler from './webhook/updates/message.js'
import * as callbackHandler from './webhook/updates/callbackQuery.js'
import * as inlineHandler from './webhook/updates/inlineQuery.js'
import * as chosenInlineResultHandler from './webhook/updates/chosenInlineResult.js'
import * as preCheckoutHandler from './webhook/updates/preCheckout.js'
import * as paymentHandler from './webhook/updates/successfulPayment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  const config = getTelegramWebhookConfig()
  if (!config.botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot not configured' } satisfies ApiEnvelope<never>)
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: { ok: true } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  if (update.inline_query) {
    return inlineHandler.handle(req, res, update, config)
  }
  if (update.chosen_inline_result) {
    return chosenInlineResultHandler.handle(req, res, update, config)
  }
  if (update.pre_checkout_query) {
    return preCheckoutHandler.handle(req, res, update, config)
  }
  if (update.message?.successful_payment) {
    return paymentHandler.handle(req, res, update, config)
  }
  if (update.callback_query) {
    return callbackHandler.handle(req, res, update, config)
  }

  return messageHandler.handle(req, res, update, config)
}

export type { TelegramWebhookConfig }
