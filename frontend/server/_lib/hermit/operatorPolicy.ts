import type { KeeprRole } from '../../commands/types.js'

function parseLeadingToken(raw: string): string {
  const trimmed = String(raw ?? '').trim().toLowerCase()
  if (!trimmed) return ''
  const first = trimmed.split(/\s+/)[0] ?? ''
  return first
}

function parseSecondToken(raw: string): string {
  const trimmed = String(raw ?? '').trim().toLowerCase()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/)
  return parts[1] ?? ''
}

export function isHermitOperatorOnlyCommand(rawCommand: string): boolean {
  const first = parseLeadingToken(rawCommand)
  if (first === '/arena' || first === '/signal') return true
  if (first !== '/strategy') return false
  return parseSecondToken(rawCommand) === 'bias'
}

export function isTrustedHermitOperator(params: {
  senderIsAllowlisted: boolean
  role: KeeprRole
  isRoomOwner: boolean
}): boolean {
  return params.senderIsAllowlisted || params.role === 'OWNER' || params.role === 'ADMIN' || params.isRoomOwner
}

