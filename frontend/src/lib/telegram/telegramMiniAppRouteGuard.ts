import { readStoredTelegramMiniAppLinkContext, readTelegramMiniAppLinkContext } from '@/lib/telegram/telegramMiniAppLink'
import { hasTelegramMiniAppEntrypointContext, loadTelegramWebApp } from '@/lib/telegram/telegramWebApp'

export function hasTelegramLinkQueryContext(search: string): boolean {
  try {
    return Boolean(readTelegramMiniAppLinkContext(new URLSearchParams(search)))
  } catch {
    return false
  }
}

export function hasTelegramLinkEntryContext(search: string): boolean {
  if (hasTelegramLinkQueryContext(search)) return true
  try {
    return Boolean(readStoredTelegramMiniAppLinkContext())
  } catch {
    return false
  }
}

export function getInitialTelegramMiniAppEntryResolution(search: string): 'ready' | 'checking' {
  return hasTelegramMiniAppEntrypointContext() || hasTelegramLinkEntryContext(search) ? 'ready' : 'checking'
}

export async function resolveTelegramMiniAppEntryBootstrap(params: {
  search: string
  bootstrapTelegramWebApp?: () => Promise<unknown>
}): Promise<boolean> {
  if (hasTelegramMiniAppEntrypointContext() || hasTelegramLinkEntryContext(params.search)) {
    return true
  }
  await (params.bootstrapTelegramWebApp ?? loadTelegramWebApp)().catch(() => null)
  return hasTelegramMiniAppEntrypointContext() || hasTelegramLinkEntryContext(params.search)
}
