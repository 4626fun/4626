import { getTelegramWebhookConfig } from '../config.js'

export async function sendTelegramStarsInvoice(params: {
  botToken: string
  chatId: string
  userId: string
  stars: number
  context: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendInvoice`
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    title: `Tip ${params.stars} Stars`,
    description: 'Support this 4626 signal with Telegram Stars.',
    payload: `tip:${params.stars}:${params.context}:${params.userId}:${Date.now()}`,
    currency: 'XTR',
    prices: [{ label: `Tip ${params.stars} Stars`, amount: params.stars }],
    start_parameter: 'tip-stars',
  }
  const providerToken = getTelegramWebhookConfig().starsProviderToken
  if (providerToken) {
    payload.provider_token = providerToken
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_send_invoice_failed_${response.status}:${details.slice(0, 180)}`)
  }
}
