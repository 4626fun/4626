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
  const fallbackMessage = errorCode || `Server returned ${response.status}.`
  return { ok: false, message: fallbackMessage, errorCode: errorCode || undefined }
}
