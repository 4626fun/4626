import { randomUUID } from 'node:crypto'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

type Logger = {
  debug: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
  child: (context: LogContext) => Logger
  withCorrelationId: (correlationId: string) => Logger
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const envLevel =
  (typeof process !== 'undefined' && (process.env.LOG_LEVEL as LogLevel | undefined)) ||
  ((typeof process !== 'undefined' && process.env.NODE_ENV === 'production') ? 'info' : 'debug')

const MIN_LEVEL: LogLevel = envLevel && LOG_LEVELS[envLevel] !== undefined ? envLevel : 'debug'

function safeData(data: unknown): unknown {
  if (data === undefined) return undefined
  if (typeof data === 'string') return data
  try {
    return JSON.parse(JSON.stringify(data))
  } catch {
    return String(data)
  }
}

function createLogger(baseContext: LogContext = {}): Logger {
  function log(level: LogLevel, msg: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return
    const payload = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...baseContext,
      ...(data === undefined ? {} : { data: safeData(data) }),
    }
    const line = JSON.stringify(payload)
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(line)
  }

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    child: (context: LogContext) => createLogger({ ...baseContext, ...context }),
    withCorrelationId: (correlationId: string) =>
      createLogger({ ...baseContext, correlationId }),
  }
}

export const logger = createLogger()

export function createCorrelationId(prefix = 'corr'): string {
  return `${prefix}-${randomUUID()}`
}

export function createCorrelationLogger(prefix = 'corr', baseContext: LogContext = {}): {
  correlationId: string
  logger: Logger
} {
  const correlationId = createCorrelationId(prefix)
  return {
    correlationId,
    logger: createLogger({ ...baseContext, correlationId }),
  }
}

