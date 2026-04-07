export const AGENT_REGISTRATION_WELL_KNOWN_PATH = '/.well-known/agent-registration.json'
export const ERC8004_DOMAIN_VERIFICATION_PATH = '/.well-known/erc8004.json'
export const STRICT_IMMUTABLE_AGENT_URI_MODE = 'strict-immutable' as const
export const STRICT_IMMUTABLE_AGENT_URI_KIND = 'data:' as const
export const STRICT_IMMUTABLE_AGENT_URI_SCHEMES = ['data:', 'ipfs://', 'ar://'] as const
export const STRICT_IMMUTABLE_AGENT_URI_SUMMARY =
  'Canonical onchain URI should stay strict immutable (data:, ipfs://, or ar://). Keep /.well-known/agent-registration.json as the public mirror and use HTTPS gateway URLs only as compatibility fallback links.'
export const STRICT_IMMUTABLE_AGENT_URI_WRITE_HINT =
  'Write the strict immutable URI onchain for agent 2205. Keep the public registration mirror and domain proof live, and use any HTTPS gateway URL only as a compatibility fallback when a scanner cannot resolve the canonical URI.'

export type AgentUriPolicy = {
  mode: typeof STRICT_IMMUTABLE_AGENT_URI_MODE
  preferredOnchainUri: string
  preferredOnchainUriKind: typeof STRICT_IMMUTABLE_AGENT_URI_KIND
  preferredSchemes: string[]
  mirrorUrl: string
  domainVerificationUrl: string
  writeOnchainHint: string
  compatibilityFallbackUrl: string | null
}

function stripTrailingSlash(origin: string): string {
  return origin.replace(/\/+$/, '')
}

function encodeJsonBase64(json: string): string {
  const bytes = new TextEncoder().encode(json)
  const globalWithBuffer = globalThis as typeof globalThis & {
    Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } }
    btoa?: (value: string) => string
  }

  if (globalWithBuffer.Buffer) {
    return globalWithBuffer.Buffer.from(bytes).toString('base64')
  }

  if (typeof globalWithBuffer.btoa === 'function') {
    let binary = ''
    bytes.forEach((value) => {
      binary += String.fromCharCode(value)
    })
    return globalWithBuffer.btoa(binary)
  }

  throw new Error('Base64 encoding is unavailable in this runtime.')
}

export function buildPublicAgentRegistrationUrl(origin: string): string {
  return `${stripTrailingSlash(origin)}${AGENT_REGISTRATION_WELL_KNOWN_PATH}`
}

export function buildPublicDomainVerificationUrl(origin: string): string {
  return `${stripTrailingSlash(origin)}${ERC8004_DOMAIN_VERIFICATION_PATH}`
}

export function toRegistrationDataUri(payload: unknown): string {
  const json = JSON.stringify(payload)
  return `data:application/json;base64,${encodeJsonBase64(json)}`
}

export function buildAgentUriPolicy(params: {
  origin: string
  registration: unknown
  compatibilityFallbackUrl?: string | null
}): AgentUriPolicy {
  return {
    mode: STRICT_IMMUTABLE_AGENT_URI_MODE,
    preferredOnchainUri: toRegistrationDataUri(params.registration),
    preferredOnchainUriKind: STRICT_IMMUTABLE_AGENT_URI_KIND,
    preferredSchemes: [...STRICT_IMMUTABLE_AGENT_URI_SCHEMES],
    mirrorUrl: buildPublicAgentRegistrationUrl(params.origin),
    domainVerificationUrl: buildPublicDomainVerificationUrl(params.origin),
    writeOnchainHint: STRICT_IMMUTABLE_AGENT_URI_WRITE_HINT,
    compatibilityFallbackUrl: params.compatibilityFallbackUrl ?? null,
  }
}
