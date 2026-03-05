import { describe, expect, it } from 'vitest'

import { formatNumberedCommandFallback, formatWelcomeNumberedOptions } from './chatCommandFallback'

describe('chat command fallback formatting', () => {
  it('renders welcome options with numbered commands', () => {
    const welcome = formatWelcomeNumberedOptions()
    expect(welcome).toContain("o henlo! I'm Keepr")
    expect(welcome).toContain('1) /help')
    expect(welcome).toContain('5) /ai <question>')
  })

  it('renders fallback intro and optional hint', () => {
    const fallback = formatNumberedCommandFallback({
      intro: 'Unknown command.',
      includeHint: 'Try /help for the full list.',
    })
    expect(fallback).toContain('Unknown command.')
    expect(fallback).toContain('3) /bankr status')
    expect(fallback).toContain('Try /help for the full list.')
  })
})
