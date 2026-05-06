// SPDX-License-Identifier: MIT
//
// Unit tests for the env-var parsers in scanCreations.ts.
//
// Guarded regression — the scan cron handler calls `readGetLogsWindow()`
// OUTSIDE its try/catch (see _scanCron.ts L216). A BigInt() throw on a
// misconfigured env value would bypass the handler's error envelope,
// return 500, and (crucially) break the schedule so operators lose the
// observable `tick: 'errored'` signal they rely on. Flagged by codex
// review on PR #527: https://github.com/wenakita/4626/pull/527
//
// These tests pin the "return DEFAULT_GETLOGS_WINDOW on garbage input"
// contract so a future refactor can't silently re-introduce the throw.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_GETLOGS_WINDOW,
  readGetLogsWindow,
} from './scanCreations.js'

declare const process: { env: Record<string, string | undefined> }

describe('readGetLogsWindow', () => {
  let savedEnv: string | undefined
  beforeEach(() => {
    savedEnv = process.env.INDEXER_GETLOGS_WINDOW
  })
  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.INDEXER_GETLOGS_WINDOW
    } else {
      process.env.INDEXER_GETLOGS_WINDOW = savedEnv
    }
  })

  it('returns the default when the env var is unset', () => {
    delete process.env.INDEXER_GETLOGS_WINDOW
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)
  })

  it('returns the default when the env var is empty or whitespace', () => {
    process.env.INDEXER_GETLOGS_WINDOW = ''
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)
    process.env.INDEXER_GETLOGS_WINDOW = '   '
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)
  })

  it('parses a valid positive integer', () => {
    process.env.INDEXER_GETLOGS_WINDOW = '5000'
    expect(readGetLogsWindow()).toBe(5000n)
  })

  it('returns the default when the value is zero or negative', () => {
    process.env.INDEXER_GETLOGS_WINDOW = '0'
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)
    // Negatives fail the digit-only regex so they're treated as invalid
    // (same outcome as the old <=0 guard — different code path).
    process.env.INDEXER_GETLOGS_WINDOW = '-5'
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)
  })

  it('returns the default on non-numeric garbage WITHOUT throwing', () => {
    // Pre-fix behaviour: each of these would have thrown SyntaxError
    // because BigInt('abc') is a throw. Post-fix: digit-only regex
    // guards the parse and we fall through to the default.
    process.env.INDEXER_GETLOGS_WINDOW = 'abc'
    expect(() => readGetLogsWindow()).not.toThrow()
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)

    process.env.INDEXER_GETLOGS_WINDOW = '10_000'
    expect(() => readGetLogsWindow()).not.toThrow()
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)

    process.env.INDEXER_GETLOGS_WINDOW = '1.5'
    expect(() => readGetLogsWindow()).not.toThrow()
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)

    process.env.INDEXER_GETLOGS_WINDOW = '1e3'
    expect(() => readGetLogsWindow()).not.toThrow()
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)

    process.env.INDEXER_GETLOGS_WINDOW = '0x10'
    expect(() => readGetLogsWindow()).not.toThrow()
    expect(readGetLogsWindow()).toBe(DEFAULT_GETLOGS_WINDOW)
  })
})
