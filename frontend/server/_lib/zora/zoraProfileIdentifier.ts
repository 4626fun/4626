import { fetchZoraProfile } from './zoraProfile.js'

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const ZORA_TRUNCATED_EOA_HANDLE_RE = /^0x[a-fA-F0-9]{4}(?:\.{3}|…)[a-fA-F0-9]{4}$/

export type SplitZoraProfileHandleResult = {
  /** Real Zora creator handle only — never a basename or Zora wallet stub. */
  zoraHandle: string | null
  /** Full Basename when Zora returns `*.base.eth` as the wallet profile handle. */
  basename: string | null
}

/**
 * Zora's GraphQLWalletProfile returns basenames and truncated EOAs as `handle`.
 * Split those from real creator handles before persisting account identity.
 */
export function splitZoraProfileHandle(raw: unknown): SplitZoraProfileHandleResult {
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/^@+/, '') : ''
  if (!trimmed) return { zoraHandle: null, basename: null }

  if (ZORA_TRUNCATED_EOA_HANDLE_RE.test(trimmed)) {
    return { zoraHandle: null, basename: null }
  }

  if (EVM_ADDRESS_RE.test(trimmed)) {
    return { zoraHandle: null, basename: null }
  }

  if (trimmed.toLowerCase().endsWith('.base.eth')) {
    return { zoraHandle: null, basename: trimmed.toLowerCase() }
  }

  return { zoraHandle: trimmed, basename: null }
}

export type ZoraProfileSeedInput = {
  zoraHandle?: string | null
  preprovZoraHandle?: string | null
  zoraCrossAppAddresses?: Array<string | null | undefined>
  canonicalCswAddress?: string | null
  externalEoas?: Array<string | null | undefined>
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

/**
 * Canonical Zora profile lookup seeds for 4626 accounts.
 * CSW (`profiles.csw_address`) is the public Zora identity for Base App creators;
 * the Privy embedded EOA is a signer only and must not win when CSW is known.
 */
export function buildZoraProfileSeeds(input: ZoraProfileSeedInput): string[] {
  const handle = normalizeZoraHandle(input.zoraHandle) ?? normalizeZoraHandle(input.preprovZoraHandle)
  const canonicalCsw = normalizeEvmAddress(input.canonicalCswAddress)
  const embedded = normalizeEvmAddress(input.embeddedEoaAddress)

  return dedupeZoraProfileSeeds([
    handle,
    ...(input.zoraCrossAppAddresses ?? []),
    canonicalCsw,
    ...(input.externalEoas ?? []),
    input.primaryWalletAddress,
    canonicalCsw ? null : embedded,
  ])
}

export function pickFirstZoraProfileSeed(input: ZoraProfileSeedInput): string | null {
  const seeds = buildZoraProfileSeeds(input)
  return seeds[0] ?? null
}

export async function fetchZoraProfileWithSeeds(
  seeds: string[],
): Promise<{ profile: any | null; seed: string | null }> {
  for (const seed of seeds) {
    const profile = await fetchZoraProfile(seed).catch(() => null)
    if (profile) return { profile, seed }
  }
  return { profile: null, seed: null }
}

export async function fetchZoraProfileForAccount(
  input: ZoraProfileSeedInput,
): Promise<{ profile: any | null; seed: string | null }> {
  return fetchZoraProfileWithSeeds(buildZoraProfileSeeds(input))
}
