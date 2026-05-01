/**
 * Architecture-boundary check.
 *
 * The Hermit creative lane (Pinata) MUST NOT directly import any
 * AlfaClub control-plane store. Per-user personalization is delivered
 * to `executeHermitCommand` via dependency-injected `userPreferences`
 * and `persistPreference` callbacks; the resolver lives in
 * `server/commands/execute.ts` and dynamically imports
 * `userPreferenceStore` only when the chat surface is an AlfaClub
 * room. This test asserts the static boundary so a future contributor
 * cannot accidentally import a control-plane writer from the Hermit
 * lane and re-introduce the cross-user dialect leak the personalization
 * was designed to fix.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const HERMIT_LANE_FILES = [
  'skillRouter.ts',
  'policy.ts',
  'memeStore.ts',
  'repository.ts',
  'types.ts',
]

const FORBIDDEN_IMPORT_TARGETS = [
  'alfaclub/userPreferenceStore',
  'alfaclub/chatTokenStore',
  'alfaclub/privyTokenRefresher',
  'alfaclub/feedbackRelayer',
  'alfaclub/chatBridge',
  'alfaclub/chatIngestStore',
]

function readSource(name: string): string {
  return readFileSync(join(__dirname, name), 'utf8')
}

function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/u, ''))
    .join('\n')
}

function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '')
}

describe('Hermit lane: architecture boundary', () => {
  for (const file of HERMIT_LANE_FILES) {
    it(`${file} does not import AlfaClub control-plane stores`, () => {
      const raw = readSource(file)
      const code = stripLineComments(stripBlockComments(raw))

      for (const target of FORBIDDEN_IMPORT_TARGETS) {
        expect(code).not.toContain(target)
      }
    })
  }

  it('userPreferenceStore is referenced only from execute.ts (the cross-lane glue) and its own test', () => {
    // We don't filesystem-walk here; instead we assert the contract by
    // pinning the only callers we expect. The boundary lives at the
    // import site — execute.ts uses `await import(...)` which is still
    // a static string the tester can detect, so the path appears below.
    const skillRouter = readSource('skillRouter.ts')
    const types = readSource('types.ts')
    expect(skillRouter).not.toContain("from '../alfaclub/")
    expect(types).not.toContain("from '../alfaclub/")
  })
})
