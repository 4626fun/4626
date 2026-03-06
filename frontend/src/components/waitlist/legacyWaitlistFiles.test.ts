import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const testDir = path.dirname(fileURLToPath(import.meta.url))

const LEGACY_WAITLIST_FILES = [
  'WaitlistFlow.tsx',
  'DeferredWaitlistFlow.tsx',
  'WaitlistDoneCelebrationBackground.tsx',
  'steps/DoneStep.tsx',
  'steps/VerifyStep.tsx',
  'useWaitlistReferral.ts',
  'useWaitlistVerification.ts',
  '../../pages/WaitlistLanding.tsx',
  '../../pages/WaitlistProfile.tsx',
]

describe('legacy waitlist cleanup', () => {
  it.each(LEGACY_WAITLIST_FILES)('removes orphaned legacy file %s', (relativePath) => {
    expect(existsSync(path.resolve(testDir, relativePath))).toBe(false)
  })
})
