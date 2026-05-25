import type { Address } from 'viem'

import { apiFetch } from '@/lib/api/apiBase'

export type RegisterBaseAppSubAccountInput = {
  parentAddress: Address
  subAccountAddress: Address
  embeddedEoaAddress: Address
}

export type RegisterBaseAppSubAccountResult = {
  ok: boolean
  message: string
  errorCode?: string
}

const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  feature_disabled:
    'Base App sub-account setup is not enabled yet. Try again after the next app update.',
  unauthenticated: 'Sign in with your verified email, then retry Base App connect.',
  profile_not_ready: 'Finish email verification before connecting Base App.',
  invalid_body: 'Could not read the connect request. Refresh and try again.',
  invalid_address: 'One of the wallet addresses was invalid. Reconnect Base App and retry.',
  sub_account_not_distinct:
    'The sub-account must differ from your parent smart wallet. Reconnect Base App and retry.',
  embedded_eoa_mismatch:
    'Your embedded signer does not match this account. Sign out, sign back in, then reconnect Base App.',
  parent_csw_conflict:
    'This account is already linked to a different parent smart wallet. Contact support if that looks wrong.',
  too_many_requests: 'Too many attempts. Wait a minute and try again.',
  db_unavailable: 'Account storage is temporarily unavailable. Try again in a few minutes.',
  unexpected_error: 'Something went wrong saving your Base App wallet. Try again.',
}

function messageForRegisterError(errorCode: string, status: number): string {
  const normalized = errorCode.trim()
  if (normalized && REGISTER_ERROR_MESSAGES[normalized]) {
    return REGISTER_ERROR_MESSAGES[normalized]
  }
  if (status === 503) {
    return REGISTER_ERROR_MESSAGES['feature_disabled']
  }
  if (status === 401) {
    return REGISTER_ERROR_MESSAGES['unauthenticated']
  }
  return normalized || `Server returned ${status}.`
}

export async function registerBaseAppSubAccountLink(
  body: RegisterBaseAppSubAccountInput,
): Promise<RegisterBaseAppSubAccountResult> {
  let response: Response
  try {
    response = await apiFetch('/api/arch-b/sub-account/baseapp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        parentAddress: body.parentAddress,
        subAccountAddress: body.subAccountAddress,
        embeddedEoaAddress: body.embeddedEoaAddress,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error while registering Base App wallet.',
    }
  }

  let payload: { success?: boolean; error?: string } | null = null
  try {
    payload = (await response.json()) as { success?: boolean; error?: string } | null
  } catch {
    payload = null
  }

  if (response.ok && payload?.success) {
    return { ok: true, message: '' }
  }

  const errorCode = (payload?.error ?? '').toString()
  return {
    ok: false,
    message: messageForRegisterError(errorCode, response.status),
    errorCode: errorCode || undefined,
  }
}
