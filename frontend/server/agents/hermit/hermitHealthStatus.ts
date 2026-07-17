export function resolveHermitProbeStatus(params: {
  probe: '/healthz' | '/readyz'
  bridgeStarted: boolean
  counterTradeRunnerEnabled: boolean
  counterTradeEffective: boolean
}): 200 | 503 {
  if (params.probe === '/healthz') return 200
  if (!params.bridgeStarted) return 503
  if (params.counterTradeRunnerEnabled && !params.counterTradeEffective) return 503
  return 200
}
