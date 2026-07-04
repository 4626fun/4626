const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export type AccountZoraProfileSeedInput = {
  zoraHandle?: string | null
  preprovZoraHandle?: string | null
  zoraCrossAppAddresses?: Array<string | null | undefined>
  canonicalCswAddress?: string | null
  primarySmartWallet?: string | null
  externalEoaAddress?: string | null
  primaryWalletAddress?: string | null
  embeddedEoaAddress?: string | null
}

export function normalizeZoraHandle(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  return raw.startsWith('@') ? raw.slice(1) : raw
}

function normalizeEvmAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw || !EVM_ADDRESS_RE.test(raw)) return null
  return raw
}

export function dedupeZoraProfileSeeds(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) continue
    const normalized = EVM_ADDRESS_RE.test(value) ? value.toLowerCase() : value
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** Client-side mirror of server `buildZoraProfileSeeds` for account-scoped UI. */
export function buildAccountZoraProfileSeeds(input: AccountZoraProfileSeedInput): string[] {
  const handle = normalizeZoraHandle(input.zoraHandle) ?? normalizeZoraHandle(input.preprovZoraHandle)
  const canonicalCsw =
    normalizeEvmAddress(input.canonicalCswAddress) ?? normalizeEvmAddress(input.primarySmartWallet)
  const embedded = normalizeEvmAddress(input.embeddedEoaAddress)

  return dedupeZoraProfileSeeds([
    handle,
    ...(input.zoraCrossAppAddresses ?? []),
    canonicalCsw,
    input.externalEoaAddress,
    input.primaryWalletAddress,
    canonicalCsw ? null : embedded,
  ])
}

export function pickAccountZoraProfileSeed(input: AccountZoraProfileSeedInput): string | undefined {
  const seed = buildAccountZoraProfileSeeds(input)[0]
  return seed || undefined
}
