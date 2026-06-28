const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 4_000
const PRIVY_ACCESS_TOKEN_ATTEMPTS = 8
const PRIVY_ACCESS_TOKEN_RETRY_DELAY_MS = 250

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => globalThis.clearTimeout(timeoutId))
  })
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export async function readPrivyAccessTokenWithRetries(params: {
  read: (() => Promise<string | null>) | null | undefined
  attempts?: number
  retryDelayMs?: number
  timeoutMs?: number | null
  validate?: (token: string) => boolean
}): Promise<string> {
  const read = params.read
  if (typeof read !== 'function') return ''
  const attempts = Math.max(1, Number(params.attempts ?? PRIVY_ACCESS_TOKEN_ATTEMPTS))
  const retryDelayMs = Math.max(0, Number(params.retryDelayMs ?? PRIVY_ACCESS_TOKEN_RETRY_DELAY_MS))
  const timeoutMs = params.timeoutMs
  const validate = params.validate

  async function readValidatedToken(): Promise<string> {
    const value = await read!().catch(() => null)
    const token = String(value ?? '').trim()
    if (!token) return ''
    if (validate && !validate(token)) return ''
    return token
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const token =
      timeoutMs === null
        ? await readValidatedToken()
        : await withTimeout(
            readValidatedToken(),
            Math.max(1, Number(timeoutMs ?? PRIVY_ACCESS_TOKEN_TIMEOUT_MS)),
            'Privy access token read timed out.',
          ).catch(() => '')
    if (token) return token
    if (attempt < attempts - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs)
    }
  }
  return ''
}

export async function readPrivyAccessTokenOrNull(params: {
  read: (() => Promise<string | null>) | null | undefined
  attempts?: number
  retryDelayMs?: number
  timeoutMs?: number | null
  validate?: (token: string) => boolean
}): Promise<string | null> {
  const token = await readPrivyAccessTokenWithRetries(params)
  return token || null
}

export async function buildPrivyAuthHeaders(params: {
  getAccessToken: (() => Promise<string | null>) | null | undefined
  attempts?: number
  retryDelayMs?: number
  timeoutMs?: number
  missingTokenMessage?: string
}): Promise<Record<string, string>> {
  const token = await readPrivyAccessTokenOrNull({
    read: params.getAccessToken ?? null,
    attempts: params.attempts,
    retryDelayMs: params.retryDelayMs,
    timeoutMs: params.timeoutMs,
  })
  if (!token) {
    throw new Error(params.missingTokenMessage ?? 'Missing Privy auth token. Sign in and retry.')
  }
  return {
    'Content-Type': 'application/json',
    'X-Privy-Token': token,
  }
}
