declare const process: { env: Record<string, string | undefined> }

export async function fetchZoraProfile(identifier: string): Promise<any | null> {
  const trimmed = typeof identifier === 'string' ? identifier.trim() : ''
  if (!trimmed) return null

  const key = String(process.env.ZORA_SERVER_API_KEY ?? '').trim()
  if (!key) return null

  const sdk: any = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(key)
  const response = await sdk.getProfile({ identifier: trimmed })
  return (response as any)?.data?.profile ?? null
}

