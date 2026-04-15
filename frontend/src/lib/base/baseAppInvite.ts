export const DEFAULT_BASE_APP_INVITE_URL = 'https://base.app/invite/4626/T9Y9BZYK'

export function resolveBaseAppInviteUrl(): string {
  const raw = String(import.meta.env.VITE_BASE_APP_INVITE_URL ?? '').trim()
  return raw || DEFAULT_BASE_APP_INVITE_URL
}
