import { describe, expect, it } from 'vitest'

import { ToolExecutionQuota } from './toolQuota.js'

describe('ToolExecutionQuota', () => {
  it('enforces the per-job limit independently across jobs', () => {
    const quota = new ToolExecutionQuota(10, 1)
    expect(quota.check('8453:job-a')).toEqual({ allowed: true })
    expect(quota.reserve('8453:job-a')).toEqual({ allowed: true })
    expect(quota.check('8453:job-a')).toEqual({
      allowed: false,
      reason: 'per_job_tool_quota_exhausted',
    })
    expect(quota.check('8453:job-b')).toEqual({ allowed: true })
  })

  it('enforces the global limit across jobs', () => {
    const quota = new ToolExecutionQuota(2, 2)
    quota.reserve('8453:job-a')
    quota.reserve('8453:job-b')
    expect(quota.check('8453:job-c')).toEqual({
      allowed: false,
      reason: 'global_tool_quota_exhausted',
    })
  })

  it('does not consume quota during a read-only check', () => {
    const quota = new ToolExecutionQuota(1, 1)
    expect(quota.check('8453:job-a')).toEqual({ allowed: true })
    expect(quota.check('8453:job-a')).toEqual({ allowed: true })
  })

  it('does not restore consumed quota after dispatch begins', () => {
    const quota = new ToolExecutionQuota(1, 1)
    quota.reserve('8453:job-a')
    expect(quota.check('8453:job-b')).toEqual({
      allowed: false,
      reason: 'global_tool_quota_exhausted',
    })
  })

  it('evicts terminal job bookkeeping without restoring global quota', () => {
    const quota = new ToolExecutionQuota(2, 2)
    quota.reserve('8453:job-a')
    expect(quota.trackedJobCount).toBe(1)
    quota.forgetJob('8453:job-a')
    expect(quota.trackedJobCount).toBe(0)
    expect(quota.reserve('8453:job-b')).toEqual({ allowed: true })
    expect(quota.check('8453:job-c')).toEqual({
      allowed: false,
      reason: 'global_tool_quota_exhausted',
    })
  })
})
