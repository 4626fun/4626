export type HealthProbePath = '/healthz' | '/readyz'

type HealthStatusArgs = {
  probe: HealthProbePath
  ready: boolean
  agentBooted: boolean
  agentCount: number
  xmtpReady: boolean
}

/**
 * /healthz is liveness for container orchestrators.
 * /readyz is strict readiness for traffic routing and monitoring.
 */
export function getHealthProbeStatusCode(args: HealthStatusArgs): number {
  if (args.probe === '/readyz') {
    return args.ready ? 200 : 503
  }

  const runtimeAgentsStopped = args.agentBooted && args.agentCount > 0 && !args.xmtpReady
  return runtimeAgentsStopped ? 503 : 200
}
