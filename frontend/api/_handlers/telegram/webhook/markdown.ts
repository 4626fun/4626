import { appendCommandMicroHints, wrapCommandListingsWithBackticks } from './utils.js'

export function shouldUseTelegramMarkdown(text: string): boolean {
  const backtickCount = (text.match(/`/g) ?? []).length
  if (backtickCount >= 2 && backtickCount % 2 === 0) return true
  return /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/i.test(text)
}

export function formatTelegramOutboundText(text: string): { text: string; useMarkdown: boolean } {
  const textWithHints = appendCommandMicroHints(text)
  const formattedText = wrapCommandListingsWithBackticks(textWithHints)
  return {
    text: formattedText,
    useMarkdown: shouldUseTelegramMarkdown(formattedText),
  }
}
