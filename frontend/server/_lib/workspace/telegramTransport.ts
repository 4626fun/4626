declare const process: { env: Record<string, string | undefined> }

export type WorkspaceTelegramSummaryPayload = {
  vaultAddress: `0x${string}`
  title: string
  lines: string[]
  chatId: string
  messageThreadId?: string | number | null
  disableWebPagePreview?: boolean
}

export type WorkspaceTelegramSummaryResult =
  | {
      sent: true
      messageId: number | null
      raw: Record<string, unknown>
    }
  | {
      sent: false
      reason: string
      error?: string
    }

export interface TelegramSummaryTransport {
  sendSummary(payload: WorkspaceTelegramSummaryPayload): Promise<WorkspaceTelegramSummaryResult>
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function formatSummaryText(payload: WorkspaceTelegramSummaryPayload): string {
  const header = `*${payload.title.trim()}*`
  const context = `Vault: \`${payload.vaultAddress}\``
  const body = payload.lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n')
  return [header, context, body].filter(Boolean).join('\n')
}

class NoopTelegramSummaryTransport implements TelegramSummaryTransport {
  async sendSummary(_payload: WorkspaceTelegramSummaryPayload): Promise<WorkspaceTelegramSummaryResult> {
    return {
      sent: false,
      reason: 'telegram_transport_disabled',
    }
  }
}

class BotTelegramSummaryTransport implements TelegramSummaryTransport {
  constructor(private readonly botToken: string) {}

  async sendSummary(payload: WorkspaceTelegramSummaryPayload): Promise<WorkspaceTelegramSummaryResult> {
    const chatId = asTrimmed(payload.chatId)
    if (!chatId) {
      return {
        sent: false,
        reason: 'telegram_chat_id_missing',
      }
    }
    const endpoint = `https://api.telegram.org/bot${this.botToken}/sendMessage`
    const messageThreadIdRaw = payload.messageThreadId
    const parsedThreadId = Number(messageThreadIdRaw)
    const messageThreadId = Number.isFinite(parsedThreadId) && parsedThreadId > 0 ? Math.floor(parsedThreadId) : null

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatSummaryText(payload),
        parse_mode: 'Markdown',
        disable_web_page_preview: payload.disableWebPagePreview !== false,
        ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
      }),
    }).catch((error: unknown) => {
      return {
        ok: false,
        status: 0,
        text: async () =>
          error instanceof Error && error.message ? error.message : 'network_error',
      } as Response
    })
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      return {
        sent: false,
        reason: `telegram_send_failed_${response.status}`,
        error: text.slice(0, 180),
      }
    }
    const parsed = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    const ok = parsed.ok === true
    if (!ok) {
      return {
        sent: false,
        reason: 'telegram_send_rejected',
        error: String(parsed.description ?? 'unknown_telegram_error').slice(0, 180),
      }
    }
    const result = asRecord(parsed.result)
    const messageId = Number(result.message_id)
    return {
      sent: true,
      messageId: Number.isFinite(messageId) ? messageId : null,
      raw: parsed,
    }
  }
}

export function createTelegramSummaryTransport(): TelegramSummaryTransport {
  const token = asTrimmed(process.env.TELEGRAM_BOT_TOKEN)
  if (!token) return new NoopTelegramSummaryTransport()
  return new BotTelegramSummaryTransport(token)
}
