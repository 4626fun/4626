import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
type ApiHandlerModule = { default?: ApiHandler }

export const telegramRouteLoaders: Record<string, () => Promise<ApiHandlerModule>> = {
  'bot-config': () => import('./telegram/_bot-config.js'),
  'link/complete': () => import('./telegram/_link-complete.js'),
  'link/ready': () => import('./telegram/_link-ready.js'),
  'link/telemetry': () => import('./telegram/_link-telemetry.js'),
  'miniapp/session': () => import('./telegram/_miniapp-session.js'),
  'metrics': () => import('./telegram/_metrics.js'),
  'portfolio': () => import('./telegram/_portfolio.js'),
  'holder-recheck': () => import('./telegram/_holder-recheck.js'),
  'unlink': () => import('./telegram/_unlink.js'),
}

export async function getTelegramApiHandler(subpath: string): Promise<ApiHandler | null> {
  const loader = telegramRouteLoaders[subpath]
  if (!loader) return null
  const mod = await loader()
  return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
}
