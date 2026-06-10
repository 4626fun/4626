import { describe, expect, it, vi } from 'vitest'

const { ensureTelemetryCreativeLogsSchemaMock } = vi.hoisted(() => ({
  ensureTelemetryCreativeLogsSchemaMock: vi.fn(async () => {}),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureTelemetryCreativeLogsSchema: ensureTelemetryCreativeLogsSchemaMock,
}))

describe('zora trend ops state transitions', () => {
  it('allows forward status transitions', async () => {
    const { applyTrendStatusTransition } = await import('./zoraTrendOpsStore')
    expect(applyTrendStatusTransition('predicted', 'deploying')).toEqual({ status: 'deploying', changed: true })
    expect(applyTrendStatusTransition('deploying', 'deployed')).toEqual({ status: 'deployed', changed: true })
    expect(applyTrendStatusTransition('deployed', 'funnel_pending')).toEqual({ status: 'funnel_pending', changed: true })
    expect(applyTrendStatusTransition('funnel_pending', 'funnel_completed')).toEqual({
      status: 'funnel_completed',
      changed: true,
    })
  })

  it('blocks regressions to earlier lifecycle states', async () => {
    const { applyTrendStatusTransition } = await import('./zoraTrendOpsStore')
    expect(applyTrendStatusTransition('deployed', 'deploying')).toEqual({ status: 'deployed', changed: false })
    expect(applyTrendStatusTransition('funnel_completed', 'deployed')).toEqual({
      status: 'funnel_completed',
      changed: false,
    })
  })

  it('allows retries from failed status', async () => {
    const { applyTrendStatusTransition } = await import('./zoraTrendOpsStore')
    expect(applyTrendStatusTransition('failed', 'deploying')).toEqual({ status: 'deploying', changed: true })
    expect(applyTrendStatusTransition('failed', 'predicted')).toEqual({ status: 'predicted', changed: true })
  })
})

describe('ensureZoraTrendOpsSchema', () => {
  it('creates the trend ops table and indexes', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [] })),
    }

    const { ensureZoraTrendOpsSchema } = await import('./zoraTrendOpsStore')
    await ensureZoraTrendOpsSchema(db as any)

    expect(ensureTelemetryCreativeLogsSchemaMock).toHaveBeenCalledTimes(1)
    expect(ensureTelemetryCreativeLogsSchemaMock).toHaveBeenCalledWith(db)
    expect(db.sql).not.toHaveBeenCalled()
  })
})
