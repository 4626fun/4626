declare const process: { env: Record<string, string | undefined> }

function readEnvFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function isCounterTradeEnabledByEnv(): boolean {
  return readEnvFlag('ALFACLUB_COUNTER_TRADE_ENABLED')
}

export function isCounterTradeRunnerEnabledByEnv(): boolean {
  return readEnvFlag('ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED')
}
