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
  // /signal is advisory Funding/OI data and is intentionally open to room members.
  if (first === '/arena') return true
  if (first === '/h' && parseSecondToken(rawCommand) === 'arena') return true
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

export function formatInverseAkitaPilotDeniedMessage(restrictedCommand: string): string {
  return [
    `Hermit \`${restrictedCommand}\` requires InverseAKITA pilot access in room 1659.`,
    'Stake at least 1 FriendKey in room 1659, or ask an operator to add your wallet to HERMIT_ALLOWED_USERS / HERMIT_OWNER_ADDRESS on the Hermit service.',
  ].join(' ')
}

