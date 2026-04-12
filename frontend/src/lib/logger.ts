import { debugLogsFlag } from '@/lib/featureFlags'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function isDebugEnabled(): boolean {
  if (debugLogsFlag()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

const MIN_LEVEL: LogLevel = isDebugEnabled() ? 'debug' : import.meta.env.PROD ? 'warn' : 'info'

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
}

function log(level: LogLevel, msg: string, data?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(`[${level.toUpperCase()}] ${msg}`, data ?? '')
}
