/** Format API jackpotUsd (decimal USD string) for UI. */
export function formatJackpotUsdDisplay(value: string | null | undefined): string | null {
  if (!value) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numeric >= 100 ? 0 : 2,
  })
}

type CreatorLotteryStatsEnvelope = {
  success?: boolean
  data?: { jackpotUsd?: string | null }
  error?: string
}

type JackpotFetcher = (
  path: string,
  init?: RequestInit & { withCredentials?: boolean },
) => Promise<Response>

/**
 * Protocol (or default-creator) jackpot USD from gauge reserve × oracle.
 * Reserve is the 69% lottery fee share held on the creator gauge.
 */
export async function fetchProtocolJackpotUsd(fetcher: JackpotFetcher): Promise<string | null> {
  const res = await fetcher('/api/v1/lottery/creator', {
    method: 'GET',
    withCredentials: true,
    headers: { Accept: 'application/json' },
  })
  const json = (await res.json().catch(() => null)) as CreatorLotteryStatsEnvelope | null
  if (!res.ok || !json?.success) return null
  const raw = json.data?.jackpotUsd
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null
}
