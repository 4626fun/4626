export function evaluateLotteryCanarySafety(params: {
  singleVaultReadOk: boolean
  singleVaultJackpotOnly: unknown
  deferredQueueReadOk: boolean
  deferredVrfQueueLength: unknown
}): {
  singleVaultEnabled: boolean
  deferredQueueEmpty: boolean
  safe: boolean
  blocker: string | null
} {
  const singleVaultEnabled =
    params.singleVaultReadOk && params.singleVaultJackpotOnly === true
  let deferredQueueEmpty = false
  if (params.deferredQueueReadOk) {
    try {
      deferredQueueEmpty = BigInt(params.deferredVrfQueueLength as any) === 0n
    } catch {
      deferredQueueEmpty = false
    }
  }
  const safe = singleVaultEnabled && deferredQueueEmpty
  return {
    singleVaultEnabled,
    deferredQueueEmpty,
    safe,
    blocker: !params.singleVaultReadOk || !params.deferredQueueReadOk
      ? 'Live LM missing singleVaultJackpotOnly / deferredVrfQueueLength — pre-remediation bytecode'
      : !singleVaultEnabled
        ? 'singleVaultJackpotOnly must be true before canary traffic'
        : !deferredQueueEmpty
          ? 'deferredVrfQueueLength must be zero before canary traffic'
          : null,
  }
}
