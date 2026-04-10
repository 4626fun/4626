import path from 'node:path'
import { describe, expect, it } from 'vitest'

// @ts-ignore NodeNext/Bundler typing for local .mjs helper is not resolved in this test project.
import { collectNonV1RetryAfterViolationsFromSource, collectReadJsonBodyReqBodyFallbackViolationsFromSource, collectV1MutatingRetryAfterViolationsFromSource, collectV1ReadJsonBodyViolationsFromSource } from '../../scripts/check-nonv1-hardening.mjs'

describe('check-nonv1-hardening script helpers', () => {
  const nonV1Path = path.join(process.cwd(), 'api/_handlers/telegram/_example.ts')
  const v1Path = path.join(process.cwd(), 'api/_handlers/v1/example.ts')
  const genericHandlerPath = path.join(process.cwd(), 'api/_handlers/auth/_example.ts')

  it('flags non-v1 429 responses without Retry-After handling', () => {
    const source = `
      export default async function handler(req, res) {
        if (!allowed) {
          return res.status(429).json({ success: false })
        }
      }
    `
    const violations = collectNonV1RetryAfterViolationsFromSource(nonV1Path, source)
    expect(violations).toHaveLength(1)
  })

  it('passes non-v1 429 responses when Retry-After is set nearby', () => {
    const source = `
      export default async function handler(req, res) {
        if (!allowed) {
          res.setHeader('Retry-After', '60')
          return res.status(429).json({ success: false })
        }
      }
    `
    const violations = collectNonV1RetryAfterViolationsFromSource(nonV1Path, source)
    expect(violations).toEqual([])
  })

  it('ignores v1 handlers for Retry-After checks', () => {
    const source = `
      export default async function handler(req, res) {
        return res.status(429).json({ success: false })
      }
    `
    const violations = collectNonV1RetryAfterViolationsFromSource(v1Path, source)
    expect(violations).toEqual([])
  })

  it('flags mutating v1 429 responses without Retry-After handling', () => {
    const source = `
      export default async function handler(req, res) {
        if (req.method !== 'POST') return
        if (!allowed) {
          return res.status(429).json({ success: false })
        }
      }
    `
    const violations = collectV1MutatingRetryAfterViolationsFromSource(v1Path, source)
    expect(violations).toHaveLength(1)
  })

  it('allows mutating v1 429 responses when Retry-After is set nearby', () => {
    const source = `
      export default async function handler(req, res) {
        if (req.method !== 'POST') return
        if (!allowed) {
          res.setHeader('Retry-After', '60')
          return res.status(429).json({ success: false })
        }
      }
    `
    const violations = collectV1MutatingRetryAfterViolationsFromSource(v1Path, source)
    expect(violations).toEqual([])
  })

  it('flags mutating v1 handlers using readJsonBody(req, ...)', () => {
    const source = `
      export default async function handler(req, res) {
        if (req.method !== 'POST') return
        const body = await readJsonBody(req, { maxBytes: 8192 })
        return res.status(200).json({ success: true, body })
      }
    `
    const violations = collectV1ReadJsonBodyViolationsFromSource(v1Path, source)
    expect(violations).toHaveLength(1)
  })

  it('allows mutating v1 handlers using readBoundedJsonObjectBody(req, ...)', () => {
    const source = `
      export default async function handler(req, res) {
        if (req.method !== 'POST') return
        const body = await readBoundedJsonObjectBody(req, { maxBytes: 8192 })
        return res.status(200).json({ success: true, body })
      }
    `
    const violations = collectV1ReadJsonBodyViolationsFromSource(v1Path, source)
    expect(violations).toEqual([])
  })

  it('flags readJsonBody(req) fallbacks to req.body', () => {
    const source = `
      const body =
        (await readJsonBody(req, { maxBytes: 8192 }).catch(() => null)) ??
        (req.body as Body | null) ??
        {}
    `
    const violations = collectReadJsonBodyReqBodyFallbackViolationsFromSource(genericHandlerPath, source)
    expect(violations).toHaveLength(1)
  })

  it('allows shared bounded helper usage', () => {
    const source = `
      const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8192 })) ?? {}
    `
    const violations = collectReadJsonBodyReqBodyFallbackViolationsFromSource(genericHandlerPath, source)
    expect(violations).toEqual([])
  })
})
