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
  timeoutMs?: number
}): Promise<string> {
  const read = params.read
  if (typeof read !== 'function') return ''
  const attempts = Math.max(1, Number(params.attempts ?? PRIVY_ACCESS_TOKEN_ATTEMPTS))
  const retryDelayMs = Math.max(0, Number(params.retryDelayMs ?? PRIVY_ACCESS_TOKEN_RETRY_DELAY_MS))
  const timeoutMs = Math.max(1, Number(params.timeoutMs ?? PRIVY_ACCESS_TOKEN_TIMEOUT_MS))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const token = await withTimeout(
      Promise.resolve()
        .then(() => read())
        .then((value) => String(value ?? '').trim())
        .catch(() => ''),
      timeoutMs,
      'Privy access token read timed out.',
    ).catch(() => '')
    if (token) return token
    if (attempt < attempts - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs)
    }
  }
  return ''
}
