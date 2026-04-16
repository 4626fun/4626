import { describe, expect, it } from 'vitest'
import {
  buildTwitterIntent,
  buildWarpcastIntent,
  buildTelegramIntent,
} from './ShareVaultButton'

const PAGE_URL = 'https://4626.fun/vault/0xabc'
const TEXT = 'Check $TEST on 4626'

describe('ShareVaultButton intent builders', () => {
  it('builds a Twitter intent URL with url + text', () => {
    const href = buildTwitterIntent(PAGE_URL, TEXT)
    expect(href.startsWith('https://twitter.com/intent/tweet?')).toBe(true)
    const params = new URL(href).searchParams
    expect(params.get('url')).toBe(PAGE_URL)
    expect(params.get('text')).toBe(TEXT)
  })

  it('builds a Warpcast intent URL with text + single embed', () => {
    const href = buildWarpcastIntent(PAGE_URL, TEXT)
    expect(href.startsWith('https://warpcast.com/~/compose?')).toBe(true)
    const params = new URL(href).searchParams
    expect(params.get('text')).toBe(TEXT)
    expect(params.getAll('embeds[]')).toEqual([PAGE_URL])
  })

  it('builds a Telegram intent URL with url + text', () => {
    const href = buildTelegramIntent(PAGE_URL, TEXT)
    expect(href.startsWith('https://t.me/share/url?')).toBe(true)
    const params = new URL(href).searchParams
    expect(params.get('url')).toBe(PAGE_URL)
    expect(params.get('text')).toBe(TEXT)
  })

  it('url-encodes reserved characters in text and url', () => {
    const specialUrl = 'https://4626.fun/vault/0xabc?ref=user&utm=share'
    const specialText = '$TEST & friends — "alpha"'
    const twitter = buildTwitterIntent(specialUrl, specialText)
    const params = new URL(twitter).searchParams
    expect(params.get('url')).toBe(specialUrl)
    expect(params.get('text')).toBe(specialText)
  })
})
