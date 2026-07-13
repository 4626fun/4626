import { describe, expect, it } from 'vitest'

import { renderTransportText } from './transportText.js'

const QUICK_START = [
  '<b>Keepr — Quick Start</b>',
  '',
  '🎮 <b>Commands</b>',
  '├ <code>/start</code> — open the home screen',
  '└ <code>/help [topic]</code> — view help',
].join('\n')

describe('renderTransportText', () => {
  it('preserves Telegram HTML for Telegram delivery', () => {
    expect(renderTransportText(QUICK_START, 'telegram')).toBe(QUICK_START)
  })

  it('renders Telegram-authored help as readable XMTP text', () => {
    const result = renderTransportText(QUICK_START, 'xmtp')

    expect(result).toContain('Keepr — Quick Start')
    expect(result).toContain('🎮 Commands')
    expect(result).toContain('`/start` — open the home screen')
    expect(result).not.toMatch(/<\/?[a-z][^>]*>/i)
  })

  it('renders quotes, links, and escaped entities without raw HTML', () => {
    const result = renderTransportText(
      '<blockquote expandable>Use &lt;safe&gt; mode</blockquote><a href="https://4626.fun">Open 4626</a>',
      'xmtp',
    )

    expect(result).toBe('> Use <safe> mode\nOpen 4626 (https://4626.fun)')
  })
})
