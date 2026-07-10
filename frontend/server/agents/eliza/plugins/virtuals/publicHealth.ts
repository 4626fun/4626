export type VirtualsPublicHealth = Readonly<{ ok: boolean }>
export type VirtualsProbeResponse = Readonly<{
  status: 200 | 404 | 503
  body: VirtualsPublicHealth | null
}>

/** Public probes intentionally expose one boolean and no operational detail. */
export function buildVirtualsPublicHealth(running: boolean): VirtualsPublicHealth {
  return { ok: running }
}

/** `/healthz` is process liveness; `/readyz` tracks SDK transport readiness. */
export function resolveVirtualsProbe(path: string | undefined, ready: boolean): VirtualsProbeResponse {
  if (path === '/healthz') return { status: 200, body: buildVirtualsPublicHealth(true) }
  if (path === '/readyz') {
    return {
      status: ready ? 200 : 503,
      body: buildVirtualsPublicHealth(ready),
    }
  }
  return { status: 404, body: null }
}
