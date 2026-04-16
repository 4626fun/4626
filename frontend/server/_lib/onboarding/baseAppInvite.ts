declare const process: { env: Record<string, string | undefined> }

export const DEFAULT_BASE_APP_INVITE_URL = 'https://base.app/invite/4626/T9Y9BZYK'

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveBaseAppInviteUrl(): string {
  const raw = asTrimmed(process.env.BASE_APP_INVITE_URL ?? '')
  return raw || DEFAULT_BASE_APP_INVITE_URL
}
