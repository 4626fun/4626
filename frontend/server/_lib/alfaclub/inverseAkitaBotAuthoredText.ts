const outboundTextUntilMs = new Map<string, number>()
const OUTBOUND_TEXT_TTL_MS = 15 * 60_000

const BOT_AUTHORED_TEXT_RES: RegExp[] = [
  /<!--\s*inverse-akita-trade-journal:v1\s*-->/i,
  /^\*\*InverseAKITA\*\*/i,
  /^InverseAKITA pilot\b/i,
  /^◆\s*\[\*\*InverseAKITA\*\*/i,
  /Autonomous Hyperliquid bot for this room/i,
  /^🧾 receipt:/,
  /wanted to invert your take/i,
  /trimmed anyway/i,
  /i was already there/i,
  /your call is my exit signal/i,
  /tried to (?:long|short)\b/i,
  /hyperliquid said no/i,
  /execution said absolutely not/i,
  /\[dry-run\]/i,
  /kek (?:top|bottom) signal/i,
  /added \$\d+ to (?:ETH|BTC|SOL|[A-Z0-9:]+) (?:long|short)/i,
  /cut \$\d+ from the (?:ETH|BTC|SOL|[A-Z0-9:]+) (?:long|short)/i,
  /sized up the (?:long|short)/i,
  /stacked the (?:long|short)/i,
  /increased .* (?:long|short)/i,
  /took \$?\d+ off the/i,
  /bearish cope is my buy signal/i,
  /(?:bullish|bearish) fanfic noted/i,
  /you sound bearish\. i sound longer/i,
  /you said up only\. i said more short/i,
]

function key(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function prune(nowMs: number): void {
  for (const [value, untilMs] of outboundTextUntilMs) {
    if (untilMs <= nowMs) outboundTextUntilMs.delete(value)
  }
}

export function registerInverseAkitaBotOutboundText(text: string, nowMs = Date.now()): void {
  const normalized = key(text)
  if (!normalized) return
  prune(nowMs)
  outboundTextUntilMs.set(normalized, nowMs + OUTBOUND_TEXT_TTL_MS)
}

export function isRegisteredInverseAkitaBotOutboundText(
  text: string,
  nowMs = Date.now(),
): boolean {
  const normalized = key(text)
  if (!normalized) return false
  prune(nowMs)
  return (outboundTextUntilMs.get(normalized) ?? 0) > nowMs
}

export function isInverseAkitaBotAuthoredChatText(text: string): boolean {
  const normalized = text.trim()
  return Boolean(normalized && BOT_AUTHORED_TEXT_RES.some((pattern) => pattern.test(normalized)))
}

export function resetInverseAkitaBotOutboundTextRegistryForTests(): void {
  outboundTextUntilMs.clear()
}
