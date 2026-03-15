export type TelegramInlineResultsButton =
  | {
      text: string
      web_app?: { url: string }
      start_parameter?: string
    }
  | Record<string, unknown>

export async function answerTelegramInlineQuery(params: {
  botToken: string
  inlineQueryId: string
  results: unknown[]
  cacheTime?: number
  isPersonal?: boolean
  nextOffset?: string
  button?: TelegramInlineResultsButton
  switchPmText?: string
  switchPmParameter?: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerInlineQuery`
  const payload = {
    inline_query_id: params.inlineQueryId,
    cache_time: params.cacheTime ?? 5,
    is_personal: params.isPersonal ?? true,
    results: params.results,
    ...(params.nextOffset ? { next_offset: params.nextOffset } : {}),
    ...(params.button ? { button: params.button } : {}),
    ...(params.switchPmText ? { switch_pm_text: params.switchPmText } : {}),
    ...(params.switchPmParameter ? { switch_pm_parameter: params.switchPmParameter } : {}),
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

export async function saveTelegramPreparedInlineMessage(params: {
  botToken: string
  userId: string | number
  result: Record<string, unknown>
  allowUserChats?: boolean
  allowBotChats?: boolean
  allowGroupChats?: boolean
  allowChannelChats?: boolean
}): Promise<{ preparedInlineMessageId: string | null }> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/savePreparedInlineMessage`
  const payload = {
    user_id: Number(params.userId),
    result: params.result,
    allow_user_chats: params.allowUserChats ?? true,
    allow_bot_chats: params.allowBotChats ?? true,
    allow_group_chats: params.allowGroupChats ?? true,
    allow_channel_chats: params.allowChannelChats ?? true,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_save_prepared_inline_failed_${response.status}:${details.slice(0, 180)}`)
  }

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { id?: string } | string }
    | null
  const result = body?.result
  if (typeof result === 'string') {
    return { preparedInlineMessageId: result.trim() || null }
  }
  if (result && typeof result === 'object' && typeof result.id === 'string') {
    return { preparedInlineMessageId: result.id.trim() || null }
  }
  return { preparedInlineMessageId: null }
}
