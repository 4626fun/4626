export type OutboundMessageTransport = 'telegram' | 'xmtp'

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    const normalized = token.toLowerCase()
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16)
      return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity
    }
    return namedEntities[normalized] ?? entity
  })
}

function renderXmtpText(value: string): string {
  const rendered = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<code>([\s\S]*?)<\/code>/gi, (_match, content: string) => `\`${content.replace(/`/g, "'")}\``)
    .replace(/<pre>([\s\S]*?)<\/pre>/gi, (_match, content: string) => `\n${content}\n`)
    .replace(/<blockquote(?:\s+expandable)?>([\s\S]*?)<\/blockquote>/gi, (_match, content: string) =>
      `${content
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}\n`,
    )
    .replace(/<a\s+href=(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi, (_match, doubleUrl, singleUrl, label) => {
      const url = doubleUrl || singleUrl
      return label === url ? label : `${label} (${url})`
    })
    .replace(/<\/?(?:b|strong|i|em|u|s|del|span)(?:\s[^>]*)?>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')

  return decodeHtmlEntities(rendered).trim()
}

export function renderTransportText(value: string, transport: OutboundMessageTransport): string {
  switch (transport) {
    case 'telegram':
      return value
    case 'xmtp':
      return renderXmtpText(value)
    default: {
      const _exhaustive: never = transport
      return _exhaustive
    }
  }
}
