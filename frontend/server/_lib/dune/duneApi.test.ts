import { describe, expect, it } from 'vitest'

import { stripSqlComments } from './duneMetricSql.js'

describe('duneMetricSql', () => {
  it('strips line comments from SQL files', () => {
    const sql = stripSqlComments(`
-- header
SELECT 1 AS ok
-- tail
`)
    expect(sql).toBe('SELECT 1 AS ok')
    expect(sql).not.toContain('--')
  })
})
