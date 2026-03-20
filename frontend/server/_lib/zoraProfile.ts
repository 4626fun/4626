declare const process: { env: Record<string, string | undefined> }

const ZORA_GET_PROFILE_TIMEOUT_MS = 20_000

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
  return (response as any)?.data?.profile ?? null
}

