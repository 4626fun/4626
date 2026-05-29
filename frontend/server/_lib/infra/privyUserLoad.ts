import { PrivyClient } from '@privy-io/server-auth'

import { extractPrivyVerifiedEmail } from './trust.js'

declare const process: { env: Record<string, string | undefined> }

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth is not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).')
  }
  return { appId, appSecret }
}

/**
 * Privy server `getUserById` can lag behind the client SDK right after email OTP,
 * especially in Base App webviews. Retry briefly before deciding verified email is absent.
 */
export async function loadPrivyUserWithVerifiedEmailRetry(params: {
  privyUserId: string
  initialUser: unknown
  attempts?: number
  delayMs?: number
}): Promise<unknown> {
  let user = params.initialUser
  if (extractPrivyVerifiedEmail(user)) return user

  const attempts = Math.max(1, params.attempts ?? 5)
  const delayMs = Math.max(0, params.delayMs ?? 250)
  const auth = getPrivyServerAuth()
  const client = new PrivyClient(auth.appId, auth.appSecret)

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    user = await client.getUserById(params.privyUserId)
    if (extractPrivyVerifiedEmail(user)) return user
  }

  return user
}
