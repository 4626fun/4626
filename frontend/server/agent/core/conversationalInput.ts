export const EMPTY_CONVERSATIONAL_PROMPT_RESPONSE = 'Ask me anything about this vault or DeFi on Base.'

export function isHandledConversationalSlashPrefix(text: string): boolean {
  const lower = String(text ?? '').trim().toLowerCase()
  return lower.startsWith('/ai') || lower.startsWith('/keepr') || lower.startsWith('/send')
}

export function isConversationalAgentInput(text: string): boolean {
  const raw = String(text ?? '').trim()
  const lower = raw.toLowerCase()
  return isHandledConversationalSlashPrefix(raw) || lower.startsWith('@keepr') || lower.startsWith('@bot') || !raw.startsWith('/')
}

export function normalizeConversationalPrompt(text: string): string {
  return String(text ?? '')
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@keepr\s*/i, '')
    .replace(/^@bot\s*/i, '')
    .trim()
}

export type ResolvedConversationalPrompt =
  | { kind: 'empty' }
  | { kind: 'prompt'; prompt: string }

export function resolveConversationalPrompt(text: string): ResolvedConversationalPrompt {
  const prompt = normalizeConversationalPrompt(text)
  if (!prompt) return { kind: 'empty' }
  return { kind: 'prompt', prompt }
}
