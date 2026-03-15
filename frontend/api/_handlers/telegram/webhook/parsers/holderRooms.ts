import { asTrimmed } from '../utils.js'

export function parseHolderRoomIdentifier(rawText: string, head: 'join' | 'eligibility'): string {
  const text = asTrimmed(rawText)
  if (!text) return ''
  const pattern = new RegExp(`^/?${head}(?:\\s+(\\S+))?`, 'i')
  const match = text.match(pattern)
  return asTrimmed(match?.[1] ?? '')
}
