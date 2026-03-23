export type TelegramCommandResponseMedia = {
  kind: 'photo'
  bytes: Uint8Array
  contentType?: string
  filename?: string
  caption?: string
  replyMarkup?: Record<string, unknown>
  suppressText?: boolean
}

export type TelegramProcessedCommandResult = {
  responseText: string
  action?: unknown
}

export function buildTelegramProcessedCommandResponse(params: {
  commandText: string
  processed: TelegramProcessedCommandResult
  buildObservedCommandText: (commandText: string, responseText: string) => string | null
  resolveMediaFromAction: (action: unknown) => TelegramCommandResponseMedia | undefined
}): {
  text: string
  media?: TelegramCommandResponseMedia
} {
  const text =
    params.buildObservedCommandText(params.commandText, params.processed.responseText) ??
    params.processed.responseText
  const media = params.resolveMediaFromAction(params.processed.action)
  return {
    text,
    ...(media ? { media } : {}),
  }
}

