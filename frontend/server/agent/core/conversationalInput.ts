export function isConversationalAgentInput(text: string): boolean {
  const raw = String(text ?? '').trim()
  const lower = raw.toLowerCase()
  return lower.startsWith('/ai') || lower.startsWith('@keepr') || lower.startsWith('@bot') || !raw.startsWith('/')
}

export function normalizeConversationalPrompt(text: string): string {
  return String(text ?? '')
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@keepr\s*/i, '')
    .replace(/^@bot\s*/i, '')
    .trim()
}
