export function formatWaitlistShortAddress(address: string): string {
  const trimmed = address.trim()
  if (trimmed.length < 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

export function isWaitlistAddressLabel(label: string): boolean {
  const trimmed = label.trim()
  return (
    /^0x[a-fA-F0-9]{4}(?:…|\.{3})[a-fA-F0-9]{4}$/.test(trimmed) ||
    /^0x[a-fA-F0-9]{40}$/.test(trimmed)
  )
}

/** Reject wallet addresses (including embedded EOAs) masquerading as Zora handles. */
export function isValidWaitlistZoraHandle(value: string | null | undefined): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return false
  const withoutAt = trimmed.replace(/^@+/, '')
  if (withoutAt.startsWith('0x')) return false
  if (/^0x[a-fA-F0-9]{40}$/i.test(withoutAt)) return false
  if (isWaitlistAddressLabel(withoutAt)) return false
  return true
}

function isWaitlistNamedIdentityLabel(
  label: string | null | undefined,
  source: WaitlistIdentitySource | null | undefined,
): boolean {
  const trimmed = label?.trim()
  if (!trimmed || !source || source === 'address') return false
  if (isWaitlistAddressLabel(trimmed)) return false
  if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) return false
  if (source === 'zora' && !isValidWaitlistZoraHandle(trimmed)) return false
  return true
}

type WaitlistIdentitySource = 'zora' | 'basename' | 'ens' | 'address'

export function formatWaitlistNamedIdentityLabel(
  label: string,
  source: Exclude<WaitlistIdentitySource, 'address'>,
): string {
  const trimmed = label.trim()
  if (!trimmed) return trimmed

  if (source === 'basename') {
    return trimmed.toLowerCase().endsWith('.base.eth')
      ? trimmed.replace(/\.base\.eth$/i, '')
      : trimmed
  }

  if (source === 'ens') {
    return trimmed.toLowerCase().endsWith('.eth') ? trimmed : `${trimmed}.eth`
  }

  if (source === 'zora' && !trimmed.startsWith('@')) {
    return `@${trimmed.replace(/^@/, '')}`
  }

  return trimmed
}

export function resolveWaitlistWelcomeCopy(input: {
  zoraHandle?: string | null
  identityDisplayName?: string | null
  identitySource?: WaitlistIdentitySource | null
  linkedEoaAddress?: string | null
  cswAddress?: string | null
  sessionAddress?: string | null
  returningViaWallet?: boolean
}): { prefix: 'Welcome back' | 'Welcome'; label: string } | null {
  const zoraRaw = isValidWaitlistZoraHandle(input.zoraHandle) ? input.zoraHandle?.trim() : null
  const zoraLabel = zoraRaw ? `@${zoraRaw.replace(/^@/, '')}` : null

  let label: string | null = null
  let isNamedIdentity = false

  if (zoraLabel) {
    label = zoraLabel
    isNamedIdentity = true
  } else if (
    isWaitlistNamedIdentityLabel(input.identityDisplayName, input.identitySource)
  ) {
    label = formatWaitlistNamedIdentityLabel(
      input.identityDisplayName!.trim(),
      input.identitySource as Exclude<WaitlistIdentitySource, 'address'>,
    )
    isNamedIdentity = true
  }

  if (!label) {
    const address =
      input.linkedEoaAddress ??
      (input.returningViaWallet ? input.sessionAddress : null) ??
      input.sessionAddress ??
      input.cswAddress
    if (address?.trim()) {
      label = formatWaitlistShortAddress(address)
    }
  }

  if (!label) return null

  const prefix = input.returningViaWallet || isNamedIdentity ? 'Welcome back' : 'Welcome'
  return { prefix, label }
}
