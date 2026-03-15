import { appendCommandMicroHints, wrapCommandListingsWithBackticks } from './utils.js'

export type TelegramParseMode = 'Markdown' | 'HTML' | null

export function shouldUseTelegramMarkdown(text: string): boolean {
  const backtickCount = (text.match(/`/g) ?? []).length
  if (backtickCount >= 2 && backtickCount % 2 === 0) return true
  return /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/i.test(text)
}

export function shouldUseTelegramHtml(text: string): boolean {
  return /<\/?(?:b|strong|i|em|u|s|code|pre|a|blockquote)\b[^>]*>/i.test(text)
}

export function formatTelegramOutboundText(text: string): { text: string; parseMode: TelegramParseMode } {
  if (shouldUseTelegramHtml(text)) {
    return { text, parseMode: 'HTML' }
  }

  const textWithHints = appendCommandMicroHints(text)
  const formattedText = wrapCommandListingsWithBackticks(textWithHints)
  return {
    text: formattedText,
    parseMode: shouldUseTelegramMarkdown(formattedText) ? 'Markdown' : null,
  }
}
