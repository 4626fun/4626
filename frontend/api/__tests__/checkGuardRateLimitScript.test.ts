import { describe, expect, it } from 'vitest'

// @ts-expect-error NodeNext/Bundler typing for local .mjs helper is not resolved in this test project.
import { collectRateLimitGuardViolationsFromSource } from '../../scripts/check-guard-rate-limit.mjs'

describe('check-guard-rate-limit script helper', () => {
  it('ignores handlers that do not call guardAgentApiRequest', () => {
    const source = `
      export async function handle(req, res) {
        return { ok: true }
      }
    `

    const violation = collectRateLimitGuardViolationsFromSource('sample.ts', source)
    expect(violation).toBeNull()
  })

  it('flags handlers that call guardAgentApiRequest without checkRateLimit/rateLimitKey', () => {
    const source = `
      export async function handle(req, res) {
        await guardAgentApiRequest(req, res)
        return { ok: true }
      }
    `

    const violation = collectRateLimitGuardViolationsFromSource('sample.ts', source)
    expect(violation).toEqual({ missing: ['checkRateLimit', 'rateLimitKey'] })
  })

  it('flags handlers missing rateLimitKey helper usage', () => {
    const source = `
      export async function handle(req, res) {
        await guardAgentApiRequest(req, res)
        await checkRateLimit(req, res, {
          bucket: 'example',
          key: 'raw-key',
        })
        return { ok: true }
      }
    `

    const violation = collectRateLimitGuardViolationsFromSource('sample.ts', source)
    expect(violation).toEqual({ missing: ['rateLimitKey'] })
  })

  it('passes when handler uses guardAgentApiRequest, checkRateLimit, and rateLimitKey', () => {
    const source = `
      export async function handle(req, res) {
        await guardAgentApiRequest(req, res)
        const key = rateLimitKey(req, getClientIp(req))
        await checkRateLimit(req, res, {
          bucket: 'example',
          key,
        })
        return { ok: true }
      }
    `

    const violation = collectRateLimitGuardViolationsFromSource('sample.ts', source)
    expect(violation).toBeNull()
  })
})
