declare const process: { env: Record<string, string | undefined> }

const ZORA_GET_PROFILE_TIMEOUT_MS = 20_000
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function extractProfile(response: any): any | null {
  return (response as any)?.data?.profile ?? null
}

export function extractCreatorCoinAddressFromProfile(profile: any): `0x${string}` | null {
  const raw = typeof profile?.creatorCoin?.address === 'string' ? profile.creatorCoin.address.trim() : ''
  if (!EVM_ADDRESS_RE.test(raw)) return null
  return raw.toLowerCase() as `0x${string}`
}

export async function fetchZoraProfile(identifier: string): Promise<any | null> {
  const trimmed = typeof identifier === 'string' ? identifier.trim() : ''
  if (!trimmed) return null

  const key = String(process.env.ZORA_SERVER_API_KEY ?? '').trim()
  if (!key) return null

  const sdk: any = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(key)
  const response = await Promise.race([
    sdk.getProfile({ identifier: trimmed }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('zora_get_profile_timeout')), ZORA_GET_PROFILE_TIMEOUT_MS)
    }),
  ])
  return extractProfile(response)
}

