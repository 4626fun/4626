export async function answerTelegramInlineQuery(params: {
  botToken: string
  inlineQueryId: string
  results: unknown[]
  cacheTime?: number
  isPersonal?: boolean
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerInlineQuery`
  const payload = {
    inline_query_id: params.inlineQueryId,
    cache_time: params.cacheTime ?? 5,
    is_personal: params.isPersonal ?? true,
    results: params.results,
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_inline_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}
