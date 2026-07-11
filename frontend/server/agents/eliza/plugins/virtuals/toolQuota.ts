export type ToolQuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: 'global_tool_quota_exhausted' | 'per_job_tool_quota_exhausted' }

/**
 * In-memory service-run execution quota. It fails closed before dispatch
 * and consumes quota before dispatch so concurrent jobs cannot exceed bounds.
 * Consumption is never rolled back because a rejected promise may follow a
 * partial remote side effect.
 */
export class ToolExecutionQuota {
  private globalExecutions = 0
  private readonly jobExecutions = new Map<string, number>()

  constructor(
    private readonly globalLimit: number,
    private readonly perJobLimit: number,
  ) {}

  check(jobKey: string): ToolQuotaDecision {
    if (this.globalExecutions >= this.globalLimit) {
      return { allowed: false, reason: 'global_tool_quota_exhausted' }
    }
    if ((this.jobExecutions.get(jobKey) ?? 0) >= this.perJobLimit) {
      return { allowed: false, reason: 'per_job_tool_quota_exhausted' }
    }
    return { allowed: true }
  }

  reserve(jobKey: string): ToolQuotaDecision {
    const decision = this.check(jobKey)
    if (!decision.allowed) return decision
    this.globalExecutions += 1
    this.jobExecutions.set(jobKey, (this.jobExecutions.get(jobKey) ?? 0) + 1)
    return { allowed: true }
  }

  /** Evict terminal-job bookkeeping without restoring service-run quota. */
  forgetJob(jobKey: string): void {
    this.jobExecutions.delete(jobKey)
  }

  get trackedJobCount(): number {
    return this.jobExecutions.size
  }
}
