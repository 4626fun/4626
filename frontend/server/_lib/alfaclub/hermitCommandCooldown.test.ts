import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isHermitCommandCooldownEnabled,
  readHermitCommandCooldownMs,
  resolveHermitCooldownCommand,
} from './hermitCommandCooldown.js'

describe('hermitCommandCooldown', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves gmeow and meme command heads', () => {
    expect(resolveHermitCooldownCommand('/gmeow')).toBe('gmeow')
    expect(resolveHermitCooldownCommand('/gmeow@bot')).toBe('gmeow')
    expect(resolveHermitCooldownCommand('/meme cat')).toBe('meme')
    expect(resolveHermitCooldownCommand('/hermit help')).toBeNull()
  })

  it('reads cooldown windows from env with sane defaults', () => {
    expect(readHermitCommandCooldownMs('gmeow')).toBe(5 * 60 * 1000)
    expect(readHermitCommandCooldownMs('meme')).toBe(10 * 60 * 1000)
    vi.stubEnv('HERMIT_GMEOW_COOLDOWN_MS', '120000')
    expect(readHermitCommandCooldownMs('gmeow')).toBe(120_000)
  })

  it('can disable cooldown globally', () => {
    vi.stubEnv('HERMIT_COMMAND_COOLDOWN_ENABLED', '0')
    expect(isHermitCommandCooldownEnabled()).toBe(false)
  })
})
