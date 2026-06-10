import { describe, expect, it } from 'vitest'

import { formatNumberedCommandFallback, formatWelcomeNumberedOptions, resolveInboundMenuText, resolveWelcomeMenuSelection } from './chatCommandFallback'

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
    expect(fallback).toContain('3) /keepr health')
    expect(fallback).toContain('Try /help for the full list.')
  })

  it('maps welcome menu numbers to commands', () => {
    expect(resolveWelcomeMenuSelection(1)).toEqual({ kind: 'command', resolvedText: '/help' })
    expect(resolveWelcomeMenuSelection(5)).toEqual({ kind: 'ai_prompt' })
    expect(resolveWelcomeMenuSelection(9)).toEqual({ kind: 'invalid', selection: '9' })
    expect(resolveInboundMenuText('2')).toEqual({ kind: 'command', resolvedText: '/keepr status' })
    expect(resolveInboundMenuText('hello')).toEqual({ kind: 'passthrough' })
  })
})
