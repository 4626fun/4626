import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureCreatorMetricsBaseSchemaMock, ensureFinalAdditiveColumnsMock } = vi.hoisted(() => ({
  ensureCreatorMetricsBaseSchemaMock: vi.fn(async () => {}),
  ensureFinalAdditiveColumnsMock: vi.fn(async () => {}),
}))

vi.mock('../db/schemaBootstrap.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../db/schemaBootstrap.js')
  return {
    ...actual,
    ensureCreatorMetricsBaseSchema: ensureCreatorMetricsBaseSchemaMock,
    ensureFinalAdditiveColumns: ensureFinalAdditiveColumnsMock,
  }
})

describe('ensureCreatorMetricsSchema', () => {
  beforeEach(() => {
    vi.resetModules()
    ensureCreatorMetricsBaseSchemaMock.mockClear()
    ensureFinalAdditiveColumnsMock.mockClear()
  })

  it('runs column migrations when base tables already exist', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join('?').trim()
      if (query.includes('to_regclass')) {
        return {
          rows: [{
            has_creator_coins: true,
            has_creators: true,
            has_state: true,
            has_daily: true,
          }],
        }
      }
      return { rows: [] }
    })

    const { ensureCreatorMetricsSchema } = await import('./creatorMetricsSync.js')
    await ensureCreatorMetricsSchema({ sql } as any)

    expect(ensureCreatorMetricsBaseSchemaMock).not.toHaveBeenCalled()
    expect(ensureFinalAdditiveColumnsMock).toHaveBeenCalledTimes(2)
  })
})
