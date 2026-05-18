export type ControlPlaneMetricEvent = {
  metric: 'control_plane.operation.status' | 'control_plane.stage.status' | 'control_plane.job.status'
  operationKind?: string | null
  stageKind?: string | null
  status: string
  chainId?: number | null
  workerKind?: string | null
  durationMs?: number | null
  operationId?: string | null
  stageId?: string | null
  jobId?: number | null
  idempotencyKey?: string | null
  scopeId?: string | null
}

export function emitControlPlaneMetric(event: ControlPlaneMetricEvent): void {
  // Keep high-cardinality fields out of label-like dimensions.
  const labels = {
    metric: event.metric,
    operationKind: event.operationKind ?? null,
    stageKind: event.stageKind ?? null,
    status: event.status,
    chainId: event.chainId ?? null,
    workerKind: event.workerKind ?? null,
  }
  const correlation = {
    operationId: event.operationId ?? null,
    stageId: event.stageId ?? null,
    jobId: event.jobId ?? null,
    idempotencyKey: event.idempotencyKey ?? null,
    scopeId: event.scopeId ?? null,
    durationMs: event.durationMs ?? null,
  }
  console.info('[control-plane/metrics]', { labels, correlation })
}

