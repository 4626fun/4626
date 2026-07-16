declare const process: { env: Record<string, string | undefined> }

const HEX_ADDRESS_RE = /^0x[a-f0-9]{40}$/i

/** Known AlfaClub bot / Hermit display handles that must never trigger reactions. */
const SELF_USERNAMES = new Set(['hermit4626', 'inverseakita', 'keepr4626'])

export function normalizeInverseAkitaChatSenderAddress(
  value: string | null | undefined,
): string | null {
  const address = String(value ?? '').trim().toLowerCase()
  return HEX_ADDRESS_RE.test(address) ? address : null
}

function pushAddress(target: Set<string>, value: string | null | undefined): void {
  const address = normalizeInverseAkitaChatSenderAddress(value)
  if (address) target.add(address)
}

function pushCsv(target: Set<string>, raw: string | null | undefined): void {
  for (const part of String(raw ?? '').split(/[,\s]+/g)) {
    pushAddress(target, part)
  }
}

/**
 * Wallet embedded in the AlfaClub chat JWT (`ALFACLUB_CHAT_JWT` linked_accounts).
 * That address is who Hermit posts as in-room (often distinct from HERMIT_OWNER).
 */
export function readAlfaClubChatJwtWalletAddresses(
  jwt = process.env.ALFACLUB_CHAT_JWT,
): string[] {
  const token = String(jwt ?? '').trim()
  if (!token) return []
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return []

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>
    const linkedRaw = payload.linked_accounts
    const linked =
      typeof linkedRaw === 'string'
        ? (JSON.parse(linkedRaw) as unknown)
        : linkedRaw
    if (!Array.isArray(linked)) return []

    const out: string[] = []
    for (const entry of linked) {
      if (!entry || typeof entry !== 'object') continue
      const address = normalizeInverseAkitaChatSenderAddress(
        (entry as { address?: unknown }).address as string | undefined,
      )
      if (address) out.push(address)
    }
    return out
  } catch {
    return []
  }
}

/**
 * Addresses that must never trigger InverseAKITA chat reactions.
 *
 * Only Hermit4626's own posting identity — the chat-JWT wallet and optional
 * `ALFACLUB_INVERSE_AKITA_CHAT_SELF_SENDERS`. Operator / room-owner wallets
 * (`HERMIT_OWNER_ADDRESS`, CANONICAL/PROTOCOL CSW) are eligible like any other
 * staker so their chat takes can be faded.
 */
export function readInverseAkitaChatSelfSenderAddresses(): Set<string> {
  const addresses = new Set<string>()
  pushCsv(addresses, process.env.ALFACLUB_INVERSE_AKITA_CHAT_SELF_SENDERS)
  for (const address of readAlfaClubChatJwtWalletAddresses()) {
    addresses.add(address)
  }
  return addresses
}

export function isInverseAkitaChatSelfSender(
  senderAddress: string | null | undefined,
  extraSelfAddresses: Iterable<string> = [],
): boolean {
  const sender = normalizeInverseAkitaChatSenderAddress(senderAddress)
  if (!sender) return false
  if (readInverseAkitaChatSelfSenderAddresses().has(sender)) return true
  for (const candidate of extraSelfAddresses) {
    if (normalizeInverseAkitaChatSenderAddress(candidate) === sender) return true
  }
  return false
}

export function isInverseAkitaChatSelfUsername(
  username: string | null | undefined,
): boolean {
  const normalized = String(username ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
  return normalized.length > 0 && SELF_USERNAMES.has(normalized)
}
