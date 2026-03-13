declare const process: { env: Record<string, string | undefined> }

export type TelegramBotCommand = {
  command: string
  description: string
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function callTelegramBotApi(params: {
  botToken: string
  method: string
  payload: Record<string, unknown>
}): Promise<void> {
  const botToken = asTrimmed(params.botToken)
  const method = asTrimmed(params.method)
  if (!botToken || !method) {
    throw new Error('telegram_bot_api_config_missing')
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/${method}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.payload),
  })
  const text = await response.text().catch(() => '')
  if (!response.ok) {
    throw new Error(`telegram_bot_api_${method}_failed_${response.status}:${text.slice(0, 180)}`)
  }
  if (!text) return
  try {
    const parsed = JSON.parse(text) as { ok?: boolean; description?: string }
    if (!parsed?.ok) {
      throw new Error(`telegram_bot_api_${method}_rejected:${asTrimmed(parsed?.description).slice(0, 120)}`)
    }
  } catch (error) {
    if (error instanceof Error) throw error
  }
}

export async function setTelegramMyCommands(params: {
  botToken: string
  commands: TelegramBotCommand[]
  scope?: Record<string, unknown>
  languageCode?: string
}): Promise<void> {
  const commands = (params.commands ?? [])
    .map((row) => ({
      command: asTrimmed(row.command).replace(/^\//, '').toLowerCase(),
      description: asTrimmed(row.description),
    }))
    .filter((row) => row.command.length > 0 && row.description.length > 0)
  if (commands.length === 0) {
    throw new Error('telegram_set_my_commands_empty')
  }

  const payload: Record<string, unknown> = { commands }
  if (params.scope && typeof params.scope === 'object') {
    payload.scope = params.scope
  }
  const languageCode = asTrimmed(params.languageCode)
  if (languageCode) {
    payload.language_code = languageCode
  }
  await callTelegramBotApi({
    botToken: params.botToken,
    method: 'setMyCommands',
    payload,
  })
}

export async function setTelegramChatMenuButton(params: {
  botToken: string
  menuButton: Record<string, unknown>
  chatId?: string
}): Promise<void> {
  const payload: Record<string, unknown> = {
    menu_button: params.menuButton,
  }
  const chatId = asTrimmed(params.chatId)
  if (chatId) {
    payload.chat_id = chatId
  }
  await callTelegramBotApi({
    botToken: params.botToken,
    method: 'setChatMenuButton',
    payload,
  })
}

export function resolveTelegramBotToken(): string {
  return asTrimmed(process.env.TELEGRAM_BOT_TOKEN ?? '')
}
