import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  _hermitPromptBuildersForTests,
  executeHermitCommand,
  pinataEndpointSupportsHttpDraft,
  shouldPreferPinataHttpDraft,
  shouldRequestPinataGmeowCaption,
} from './skillRouter'

describe('executeHermitCommand', () => {
  let restoreEnv: (() => void) | null = null
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.restoreAllMocks()
  })

  it('uses pinata provider for /hermit and returns text', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Hermit from Pinata' }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/hermit gm',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.provider).toBe('pinata')
    expect(result.kind).toBe('hermit')
    expect(result.reply).toBe('Hermit from Pinata')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects /hermit when pinata path is not configured', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: undefined,
      HERMIT_PINATA_BEARER_TOKEN: undefined,
    })

    await expect(
      executeHermitCommand({
        commandText: '/hermit gm',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).rejects.toThrow('Hermit Pinata path unavailable')
  })

  it('returns usage context for /hermit without calling pinata', async () => {
    const result = await executeHermitCommand({
      commandText: '/hermit',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('/hermit announce <news>')
    expect(result.reply).toContain('/hermit tone <message>')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns usage context for /hermit help', async () => {
    const result = await executeHermitCommand({
      commandText: '/hermit help',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('Hermit drafts room-ready copy.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('supports /arena status in room 1659 when enabled', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
    })
    const result = await executeHermitCommand({
      commandText: '/arena status',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })
    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('Arena status:')
    expect(result.reply).toContain('enabled=true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects /arena commands outside allowed rooms', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
    })
    const result = await executeHermitCommand({
      commandText: '/arena status',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1043',
    })
    expect(result.reply).toContain('only enabled in approved rooms')
  })

  it('enforces HIP-3 xyz prefix on /arena trade', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_TRADING_ENABLED: '1',
      ARENA_DRY_RUN: '1',
      ARENA_DGCLAW_DIR: '/tmp',
    })
    const result = await executeHermitCommand({
      commandText: '/arena trade open foo:bar long 1000 2',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })
    expect(result.reply).toContain('xyz: prefix')
  })

  it('keeps /arena execution in dry-run by default', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_TRADING_ENABLED: '1',
      ARENA_DRY_RUN: '1',
      ARENA_DGCLAW_DIR: '/tmp',
    })
    const result = await executeHermitCommand({
      commandText: '/arena trade open xyz:GOLD long 5000 3',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })
    expect(result.reply).toContain('Open submitted for xyz:GOLD.')
    expect(result.reply).toContain('[dry-run]')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses a rotating bundled meme for plain /gmeow', async () => {
    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('https://')
    // /gmeow should still emit an inline media attachment so the
    // AlfaClub client renders it as an image rather than a hyperlink.
    expect(result.mediaAttachments).toEqual([
      {
        url: expect.stringContaining('/giphy.gif'),
        type: 'photo',
        filename: 'giphy.gif',
        mime_type: 'image/gif',
      },
    ])
  })

  it('returns a laugh-tagged meme for /gmeow laugh', async () => {
    const result = await executeHermitCommand({
      commandText: '/gmeow laugh',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.meme?.tags).toContain('laugh')
    expect(result.reply).toContain('https://')
    expect(result.mediaAttachments?.[0]?.url).toMatch(/giphy\.com|tenor\.com/)
  })

  it('uses pinata for bare /gmeow when pinata is configured (creative default)', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'fresh cave energy.' }) }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('pinata')
    expect(result.reply).toContain('fresh cave energy.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses pinata for /gmeow when user supplies a prompt (default policy)', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'custom cat line.' }) }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/gmeow moon mission',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.provider).toBe('pinata')
    expect(result.reply).toContain('custom cat line.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses pinata provider for /gmeow when HERMIT_GMEOW_PINATA_CAPTION=always', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_PINATA_CAPTION: 'always',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'cat laugh alpha unlocked.' }) }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('pinata')
    expect(result.reply).toContain('cat laugh alpha unlocked.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses HTTP draft (not gateway) for AlfaClub bridge /gmeow on non-Pinata draft endpoints', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://draft.example/v1/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_PINATA_CAPTION: 'always',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'bridge-safe cat laugh.' }) }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sourceIdentity: 'alfaclub-bridge-runner',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('pinata')
    expect(result.reply).toContain('bridge-safe cat laugh.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://draft.example/v1/chat')
  })

  it('shouldPreferPinataHttpDraft defaults to HTTP for bridge-runner on generic endpoints', () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_BRIDGE_HTTP_ONLY: undefined,
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
    })
    expect(
      shouldPreferPinataHttpDraft({
        sourceIdentity: 'alfaclub-bridge-runner',
        prompt: 'casual meme caption only',
      }),
    ).toBe(true)
  })

  it('shouldPreferPinataHttpDraft uses gateway for Pinata-hosted agents', () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_BRIDGE_HTTP_ONLY: undefined,
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://x7lmjaxx.agents.pinata.cloud',
    })
    expect(
      shouldPreferPinataHttpDraft({
        sourceIdentity: 'alfaclub-bridge-runner',
        prompt: 'casual meme caption only',
      }),
    ).toBe(false)
  })

  it('pinataEndpointSupportsHttpDraft is false for agents.pinata.cloud hosts', () => {
    expect(pinataEndpointSupportsHttpDraft('https://x7lmjaxx.agents.pinata.cloud')).toBe(false)
    expect(pinataEndpointSupportsHttpDraft('https://pinata.example/chat')).toBe(true)
  })

  it('shouldPreferPinataHttpDraft allows gateway when HERMIT_PINATA_BRIDGE_HTTP_ONLY=0', () => {
    restoreEnv = applyEnv({ HERMIT_PINATA_BRIDGE_HTTP_ONLY: '0' })
    expect(
      shouldPreferPinataHttpDraft({
        sourceIdentity: 'alfaclub-bridge-runner',
        prompt: 'casual meme caption only',
      }),
    ).toBe(false)
  })

  it('shouldRequestPinataGmeowCaption respects env modes', () => {
    expect(shouldRequestPinataGmeowCaption('')).toBe(true)
    expect(shouldRequestPinataGmeowCaption('moon')).toBe(true)
    restoreEnv = applyEnv({ HERMIT_GMEOW_PINATA_CAPTION: '0' })
    expect(shouldRequestPinataGmeowCaption('')).toBe(false)
    restoreEnv = applyEnv({ HERMIT_GMEOW_PINATA_CAPTION: 'local' })
    expect(shouldRequestPinataGmeowCaption('moon')).toBe(false)
    restoreEnv = applyEnv({ HERMIT_GMEOW_PINATA_CAPTION: 'prompt' })
    expect(shouldRequestPinataGmeowCaption('')).toBe(false)
    expect(shouldRequestPinataGmeowCaption('moon')).toBe(true)
  })

  it('/gmeow falls back to local caption when pinata returns provider auth error text', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_PINATA_CAPTION: 'always',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: 'Agent failed before reply: OAuth token refresh failed for openai-codex',
      }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/https:\/\//)
    expect(result.reply.split('\n')[0]?.length).toBeGreaterThan(4)
    expect(result.reply.toLowerCase()).not.toContain('oauth token refresh failed')
  })

  it('/gmeow falls back to local caption when pinata throws', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_PINATA_CAPTION: 'always',
    })
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'))

    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('https://')
    expect(result.reply.split('\n')[0]?.length).toBeGreaterThan(4)
  })

  it('/gmeow still replies when explicit dialect persistence fails', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_PINATA_CAPTION: 'always',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'jajaja alpha cat.' }) }),
    } as Response)

    const persistPreference = vi.fn(async () => {
      throw new Error('db unavailable')
    })

    const result = await executeHermitCommand({
      commandText: '/gmeow 🇲🇽',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1043',
      persistPreference,
    })

    expect(result.kind).toBe('gmeow')
    expect(result.reply).toContain('https://')
    expect(result.reply).toContain('jajaja alpha cat.')
    expect(persistPreference).toHaveBeenCalled()
  })

  it('uses /meme for the Pinata image prompt path', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Akita cat meme prompt' }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/meme akita black cat',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.provider).toBe('pinata')
    expect(result.kind).toBe('meme')
    expect(result.imagePrompt).toBe('Akita cat meme prompt')
  })

  it('formats structured JSON from pinata for /hermit', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          line: 'Vault room just hit escape velocity.',
          alt: ['Liquidity is cooking.', 'Alpha drops in 10.'],
          hashtags: ['#4626', '#AlfaClub'],
          cta: 'Drop your thesis.',
        }),
      }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/hermit announce vault update',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('hermit')
    expect(result.reply).toContain('Vault room just hit escape velocity.')
    expect(result.reply).toContain('CTA: Drop your thesis.')
    expect(result.reply).toContain('#4626 #AlfaClub')
  })

  it('formats structured JSON from pinata for /meme', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          imagePrompt: 'Noir akita in a neon trading pit',
          caption: 'Tape turns green, tails up.',
          hashtags: ['#4626', '#meme'],
        }),
      }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/meme noir akita',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('meme')
    expect(result.imagePrompt).toBe('Noir akita in a neon trading pit')
    expect(result.reply).toContain('Prompt: Noir akita in a neon trading pit')
    expect(result.reply).toContain('Caption: Tape turns green, tails up.')
  })

  it('rejects /meme when pinata path is not configured', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: undefined,
      HERMIT_PINATA_BEARER_TOKEN: undefined,
    })

    await expect(
      executeHermitCommand({
        commandText: '/meme akita black cat',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).rejects.toThrow('Hermit meme path unavailable')
  })

  describe('Spanish language behaviour', () => {
    it('embeds the language directive in /hermit, /meme, and /gmeow prompts', () => {
      const hermitPrompt = _hermitPromptBuildersForTests.buildHermit({
        mode: 'announce',
        userPrompt: 'reward drop opens in 30 minutes',
      })
      const imagePrompt = _hermitPromptBuildersForTests.buildImage('akita black cat')
      const gmeowPrompt = _hermitPromptBuildersForTests.buildGmeow({
        userPrompt: 'gmeow',
        memeCaption: 'cat laugh',
        memeTags: ['laugh', 'cat'],
      })

      for (const prompt of [hermitPrompt, imagePrompt, gmeowPrompt]) {
        expect(prompt).toContain('Latin American Spanish')
        expect(prompt).toContain('JSON keys always remain')
        expect(prompt).toContain('no markdown')
      }
    })

    it('keeps JSON keys English in the prompt schema', () => {
      const prompt = _hermitPromptBuildersForTests.buildHermit({
        mode: 'copy',
        userPrompt: 'haz una línea para el vault drop en español',
      })
      expect(prompt).toContain('{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}')
      expect(prompt).not.toMatch(/\{"linea"/)
      expect(prompt).not.toMatch(/\{"línea"/)
    })

    it('passes Spanish JSON values straight through for /hermit', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: JSON.stringify({
            line: 'El vault acaba de despegar. Liquidez encendida.',
            alt: ['Alpha en 10.', 'Liquidez encendida.'],
            hashtags: ['#4626', '#AlfaClub'],
            cta: 'Reclama tu drop.',
          }),
        }),
      } as Response)

      const result = await executeHermitCommand({
        commandText: '/hermit announce drop nuevo en 30 minutos',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })

      expect(result.kind).toBe('hermit')
      expect(result.provider).toBe('pinata')
      expect(result.reply).toContain('El vault acaba de despegar.')
      expect(result.reply).toContain('CTA: Reclama tu drop.')
      expect(result.reply).toContain('#4626 #AlfaClub')
      expect(result.reply).not.toContain('```')
    })

    it('passes Spanish JSON values straight through for /meme', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: JSON.stringify({
            imagePrompt: 'Akita noir en un foso de trading neon',
            caption: 'Cinta verde, colas arriba.',
            hashtags: ['#4626', '#meme'],
          }),
        }),
      } as Response)

      const result = await executeHermitCommand({
        commandText: '/meme akita noir en español',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })

      expect(result.kind).toBe('meme')
      expect(result.imagePrompt).toBe('Akita noir en un foso de trading neon')
      expect(result.reply).toContain('Caption: Cinta verde, colas arriba.')
      expect(result.reply).not.toContain('```')
    })

    it('keeps English behaviour unchanged when the user writes English', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: JSON.stringify({
            line: 'Vault room just hit escape velocity.',
            alt: ['Liquidity is cooking.', 'Alpha drops in 10.'],
            hashtags: ['#4626'],
            cta: 'Drop your thesis.',
          }),
        }),
      } as Response)

      const result = await executeHermitCommand({
        commandText: '/hermit announce vault update',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })

      expect(result.reply).toContain('Vault room just hit escape velocity.')
      expect(result.reply).toContain('CTA: Drop your thesis.')
      expect(result.reply).not.toContain('```')
    })

    it('default English prompt has no explicit dialect signal but lists neutral_latam fallback', () => {
      const prompt = _hermitPromptBuildersForTests.buildHermit({
        mode: 'announce',
        userPrompt: 'vault update incoming',
      })
      expect(_hermitPromptBuildersForTests.detectDialect('vault update incoming')).toBeNull()
      expect(prompt).toContain('Spanish dialect: neutral_latam')
      expect(prompt).not.toContain('user signaled')
    })
  })

  describe('Spanish dialect routing', () => {
    const flagCases: Array<{ flag: string; dialect: string }> = [
      { flag: '🇲🇽', dialect: 'mexico' },
      { flag: '🇦🇷', dialect: 'argentina' },
      { flag: '🇨🇴', dialect: 'colombia' },
      { flag: '🇨🇱', dialect: 'chile' },
      { flag: '🇵🇪', dialect: 'peru' },
      { flag: '🇻🇪', dialect: 'venezuela' },
      { flag: '🇵🇷', dialect: 'caribbean' },
      { flag: '🇪🇸', dialect: 'spain' },
      { flag: '🌎', dialect: 'neutral_latam' },
      { flag: '🇺🇳', dialect: 'neutral_latam' },
    ]

    it.each(flagCases)('detects $dialect from $flag', ({ flag, dialect }) => {
      expect(_hermitPromptBuildersForTests.detectDialect(`drop nuevo ${flag}`)).toBe(dialect)
    })

    const textHints: Array<{ hint: string; dialect: string }> = [
      { hint: 'haz una línea mexicana para vault', dialect: 'mexico' },
      { hint: 'en argentino dale, drop nuevo', dialect: 'argentina' },
      { hint: 'algo colombiano para el room', dialect: 'colombia' },
      { hint: 'estilo chileno por favor', dialect: 'chile' },
      { hint: 'tono peruano para el quest', dialect: 'peru' },
      { hint: 'venezolano corto, gm vault', dialect: 'venezuela' },
      { hint: 'puertorriqueño para el drop', dialect: 'caribbean' },
      { hint: 'caribeño suave', dialect: 'caribbean' },
      { hint: 'castellano peninsular, vault drop', dialect: 'spain' },
      { hint: 'español de España, vault drop', dialect: 'spain' },
      { hint: 'neutral latam por favor', dialect: 'neutral_latam' },
      { hint: 'español neutro', dialect: 'neutral_latam' },
    ]

    it.each(textHints)('detects $dialect from text hint "$hint"', ({ hint, dialect }) => {
      expect(_hermitPromptBuildersForTests.detectDialect(hint)).toBe(dialect)
    })

    it('returns null when no flag or hint is present (English fallthrough)', () => {
      expect(_hermitPromptBuildersForTests.detectDialect('vault update tonight')).toBeNull()
      expect(_hermitPromptBuildersForTests.detectDialect('drop nuevo en 30 minutos')).toBeNull()
    })

    it('flag takes precedence over text hint when both appear', () => {
      // 🇦🇷 flag should win even though "mexicano" is in the text.
      expect(
        _hermitPromptBuildersForTests.detectDialect('mexicano vibe 🇦🇷 drop nuevo'),
      ).toBe('argentina')
    })

    it('embeds the dialect line + subtle-flavor guidance in /hermit prompts', () => {
      const prompt = _hermitPromptBuildersForTests.buildHermit({
        mode: 'announce',
        userPrompt: '🇦🇷 drop nuevo en 30 minutos',
      })
      expect(prompt).toContain('Spanish dialect: argentina')
      expect(prompt).toContain('voseo')
      expect(prompt).toContain('80% clear Spanish, 20% regional flavor')
      expect(prompt).toContain('caricature')
      // Schema preserved.
      expect(prompt).toContain('{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}')
    })

    it('embeds the dialect line in /meme and /gmeow prompts', () => {
      const memePrompt = _hermitPromptBuildersForTests.buildImage('🇲🇽 akita en estilo neon')
      const gmeowPrompt = _hermitPromptBuildersForTests.buildGmeow({
        userPrompt: '🇨🇱 gmeow gato risueño',
        memeCaption: 'cat laugh',
        memeTags: ['laugh', 'cat'],
      })
      expect(memePrompt).toContain('Spanish dialect: mexico')
      expect(gmeowPrompt).toContain('Spanish dialect: chile')
    })

    it('falls back to neutral_latam directive when no signal is present', () => {
      const directive = _hermitPromptBuildersForTests.buildLanguageDirective(null)
      expect(directive).toContain('Spanish dialect: neutral_latam')
      expect(directive).toContain('Default Spanish dialect is "neutral_latam"')
    })

    it('keeps JSON keys English even with a dialect signal', () => {
      const prompt = _hermitPromptBuildersForTests.buildHermit({
        mode: 'copy',
        userPrompt: '🇪🇸 haz una línea para el vault drop',
      })
      expect(prompt).toContain('{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}')
      expect(prompt).not.toMatch(/\{"linea"/)
      expect(prompt).not.toMatch(/\{"línea"/)
    })

    it('does not add dialect signal markers for plain English input', () => {
      const prompt = _hermitPromptBuildersForTests.buildHermit({
        mode: 'announce',
        userPrompt: 'vault update incoming',
      })
      expect(prompt).not.toContain('user signaled')
      expect(prompt).toContain('Default Spanish dialect is "neutral_latam"')
    })

    describe('memory persistence directive', () => {
      // Per-user dialect persistence now lives in the AlfaClub control-plane
      // user_preference table (per (room, sender)). The shared workspace
      // MEMORY.md must NOT be rewritten per turn — that would leak one user's
      // dialect to every other user in the room.
      it('explicit flag emits a clause that defers persistence to the control plane and forbids MEMORY.md writes', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'announce',
          userPrompt: '🇦🇷 drop nuevo en 30 minutos',
        })
        expect(prompt).toContain('Memory persistence (explicit signal)')
        expect(prompt).toContain('"argentina"')
        expect(prompt).toContain('control plane will save that preference for THIS sender only')
        expect(prompt).toContain('MUST NOT modify workspace MEMORY.md')
      })

      it('explicit text hint behaves identically to a flag (defers to control plane)', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'copy',
          userPrompt: 'haz una línea mexicana para el vault drop',
        })
        expect(prompt).toContain('Memory persistence (explicit signal)')
        expect(prompt).toContain('"mexico"')
        expect(prompt).toContain('MUST NOT modify workspace MEMORY.md')
      })

      it('no signal: emits a no-write clause and tells Hermit to default to neutral_latam', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'announce',
          userPrompt: 'vault update incoming',
        })
        expect(prompt).toContain('no per-user dialect signal this turn')
        expect(prompt).toContain('default to neutral_latam')
        expect(prompt).toContain('Do NOT modify workspace MEMORY.md')
        expect(prompt).not.toContain('Memory persistence (explicit signal)')
      })

      it('persisted-preference source: clause references the saved preference and forbids MEMORY.md writes', () => {
        const directive = _hermitPromptBuildersForTests.buildLanguageDirective('spain', 'persisted')
        expect(directive).toContain('saved preference is the "spain" dialect')
        expect(directive).toContain('Memory persistence (saved preference)')
        expect(directive).toContain('Do NOT modify workspace MEMORY.md')
      })

      it('explicit signal directive identifies the user-supplied dialect for this turn', () => {
        const directive = _hermitPromptBuildersForTests.buildLanguageDirective('spain', 'explicit')
        expect(directive).toContain('The user signaled the "spain" dialect this turn')
        expect(directive).toContain('Memory persistence (explicit signal)')
        expect(directive).toContain('MUST NOT modify workspace MEMORY.md')
      })

      it('strict JSON output constraint is reinforced even with no MEMORY.md mention', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'announce',
          userPrompt: '🇲🇽 drop nuevo en 30 minutos',
        })
        // Schema preserved
        expect(prompt).toContain('{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}')
        // Strict JSON contract rule
        expect(prompt).toContain('final assistant message MUST be ONLY the strict JSON object')
      })

      it('persistence clause is embedded in /meme and /gmeow prompts too', () => {
        const memePrompt = _hermitPromptBuildersForTests.buildImage('🇨🇱 akita en estilo neon')
        const gmeowPrompt = _hermitPromptBuildersForTests.buildGmeow({
          userPrompt: '🇵🇪 gmeow gato risueño',
          memeCaption: 'cat laugh',
          memeTags: ['laugh', 'cat'],
        })
        expect(memePrompt).toContain('Memory persistence (explicit signal)')
        expect(memePrompt).toContain('"chile"')
        expect(memePrompt).toContain('MUST NOT modify workspace MEMORY.md')
        expect(gmeowPrompt).toContain('Memory persistence (explicit signal)')
        expect(gmeowPrompt).toContain('"peru"')
        expect(gmeowPrompt).toContain('MUST NOT modify workspace MEMORY.md')
      })

      it('persistence clause helper covers every dialect across explicit/persisted/default sources', () => {
        const dialects = [
          'neutral_latam',
          'mexico',
          'argentina',
          'colombia',
          'chile',
          'peru',
          'venezuela',
          'caribbean',
          'spain',
        ] as const
        for (const dialect of dialects) {
          const explicit = _hermitPromptBuildersForTests.buildMemoryPersistenceClause(dialect, 'explicit')
          expect(explicit).toContain('Memory persistence (explicit signal)')
          expect(explicit).toContain(`"${dialect}"`)
          expect(explicit).toContain('MUST NOT modify workspace MEMORY.md')

          const persisted = _hermitPromptBuildersForTests.buildMemoryPersistenceClause(dialect, 'persisted')
          expect(persisted).toContain('Memory persistence (saved preference)')
          expect(persisted).toContain(`"${dialect}"`)
          expect(persisted).toContain('Do NOT modify workspace MEMORY.md')
        }
        const noSignal = _hermitPromptBuildersForTests.buildMemoryPersistenceClause(null, 'default')
        expect(noSignal).toContain('no per-user dialect signal')
        expect(noSignal).toContain('Do NOT modify workspace MEMORY.md')
      })
    })

    it('passes Argentine-flagged JSON values straight through end-to-end', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: JSON.stringify({
            line: 'El vault ya despegó, dale. Liquidez encendida.',
            alt: ['Tenés alpha en 10.', 'Sumate temprano.'],
            hashtags: ['#4626', '#AlfaClub'],
            cta: 'Reclamá tu drop.',
          }),
        }),
      } as Response)

      const result = await executeHermitCommand({
        commandText: '/hermit announce 🇦🇷 drop nuevo en 30 minutos',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })

      expect(result.kind).toBe('hermit')
      expect(result.provider).toBe('pinata')
      expect(result.reply).toContain('El vault ya despegó, dale.')
      expect(result.reply).toContain('CTA: Reclamá tu drop.')
      expect(result.reply).not.toContain('```')
    })
  })

  describe('Pinata HTTP fallback timeout', () => {
    it('passes an AbortSignal when calling the Pinata HTTP endpoint', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
        HERMIT_PINATA_HTTP_TIMEOUT_MS: '5000',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'ok' }),
      } as Response)

      await executeHermitCommand({
        commandText: '/hermit copy gm',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it('falls back gracefully when the HTTP endpoint throws (network/timeout)', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      await expect(
        executeHermitCommand({
          commandText: '/hermit copy gm',
          senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }),
      ).rejects.toThrow('Hermit Pinata path unavailable')
    })

    it('/gmeow degrades to local meme when the HTTP endpoint throws', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const result = await executeHermitCommand({
        commandText: '/gmeow laugh',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })

      expect(result.kind).toBe('gmeow')
      expect(result.provider).toBe('local')
      expect(result.meme?.tags).toContain('laugh')
      expect(result.reply).toContain('https://')
    })
  })
})
