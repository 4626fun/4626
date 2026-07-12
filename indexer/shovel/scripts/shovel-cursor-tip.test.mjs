#!/usr/bin/env node
/**
 * Unit tests for shovel.task_updates tip aggregation helpers.
 * Run: node --test scripts/shovel-cursor-tip.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSlowestCursorTipSql,
  interpretSlowestCursorTip,
} from './shovel-cursor-tip.mjs'

test('buildSlowestCursorTipSql uses per-ig MAX then MIN across integrations', () => {
  const sql = buildSlowestCursorTipSql([
    'protocol_lottery_winners',
    'protocol_lottery_entries',
  ])
  assert.match(sql, /max\(src_num::bigint\) as tip/i)
  assert.match(sql, /group by ig_name/i)
  assert.match(sql, /coalesce\(min\(tip\), 0\)/i)
  assert.match(sql, /protocol_lottery_winners/)
  assert.match(sql, /protocol_lottery_entries/)
})

test('buildSlowestCursorTipSql rejects unsafe names', () => {
  assert.throws(() => buildSlowestCursorTipSql(["evil'; drop table x;--"]), /invalid/)
})

test('interpretSlowestCursorTip requires all integrations present', () => {
  const missing = interpretSlowestCursorTip(
    { tipRaw: '100', presentRaw: '2', missingRaw: 'protocol_lottery_entries' },
    3,
  )
  assert.equal(missing.ok, false)
  assert.deepEqual(missing.missing, ['protocol_lottery_entries'])
})

test('interpretSlowestCursorTip returns live tip when complete', () => {
  const ok = interpretSlowestCursorTip(
    { tipRaw: '48521574', presentRaw: '3', missingRaw: '' },
    3,
  )
  assert.equal(ok.ok, true)
  assert.equal(ok.tip, 48521574)
})
