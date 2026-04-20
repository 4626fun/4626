export type HealthProbePath = '/healthz' | '/readyz'

type HealthStatusArgs = {
  probe: HealthProbePath
  ready: boolean
  agentBooted: boolean
  agentCount: number
  xmtpReady: boolean
  readyzAsLiveness?: boolean
}

/**
 * /healthz is liveness for container orchestrators.
 * /readyz is strict readiness for traffic routing and monitoring.
 */
export function getHealthProbeStatusCode(args: HealthStatusArgs): number {
  const runtimeAgentsStopped = args.agentBooted && args.agentCount > 0 && !args.xmtpReady

  if (args.probe === '/readyz') {
    if (args.readyzAsLiveness) {
      return runtimeAgentsStopped ? 503 : 200
    }
    return args.ready ? 200 : 503
  }

  return runtimeAgentsStopped ? 503 : 200
}
