import path from 'node:path'
import { describe, expect, it } from 'vitest'

// @ts-expect-error NodeNext/Bundler typing for local .mjs helper is not resolved in this test project.
import { collectGlobal429RetryAfterViolationsFromSource } from '../../scripts/check-api-429-retry-after.mjs'

describe('check-api-429-retry-after script helper', () => {
  const handlerPath = path.join(process.cwd(), 'api/_handlers/example.ts')

  it('flags 429 status call without Retry-After handling', () => {
    const source = `
      export default async function handler(req, res) {
        return res.status(429).json({ success: false })
      }
    `
    const violations = collectGlobal429RetryAfterViolationsFromSource(handlerPath, source)
    expect(violations).toHaveLength(1)
  })

  it('passes 429 status call when Retry-After is set nearby', () => {
    const source = `
      export default async function handler(req, res) {
        res.setHeader('Retry-After', '60')
        return res.status(429).json({ success: false })
      }
    `
    const violations = collectGlobal429RetryAfterViolationsFromSource(handlerPath, source)
    expect(violations).toEqual([])
  })

  it('flags statusCode=429 assignment without Retry-After handling', () => {
    const source = `
      export default async function handler(req, res) {
        res.statusCode = 429
        return res.json({ success: false })
      }
    `
    const violations = collectGlobal429RetryAfterViolationsFromSource(handlerPath, source)
    expect(violations).toHaveLength(1)
  })

  it('passes statusCode=429 assignment when helper indicates Retry-After handling', () => {
    const source = `
      export default async function handler(req, res) {
        setRateLimitHeaders(res, { retryAfterSeconds: 7 })
        res.statusCode = 429
        return res.json({ success: false })
      }
    `
    const violations = collectGlobal429RetryAfterViolationsFromSource(handlerPath, source)
    expect(violations).toEqual([])
  })
})
