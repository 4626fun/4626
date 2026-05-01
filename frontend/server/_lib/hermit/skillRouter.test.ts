import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import { _hermitPromptBuildersForTests, executeHermitCommand } from './skillRouter'

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

  it('uses the bundled cat laugh meme for plain /gmeow', async () => {
    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.reply).toContain('cat laugh')
    expect(result.reply).toContain('https://4626.fun/ipfs/')
    expect(result.mediaAttachments).toBeUndefined()
  })

  it('returns the bundled cat laugh meme for /gmeow laugh', async () => {
    const result = await executeHermitCommand({
      commandText: '/gmeow laugh',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.reply).toContain('cat laugh')
    expect(result.reply).toContain('https://4626.fun/ipfs/')
    expect(result.mediaAttachments).toBeUndefined()
  })

  it('uses pinata provider for /gmeow when pinata draft env is configured', async () => {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
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
      it('explicit flag emits a persistence-write clause that records the dialect into MEMORY.md', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'announce',
          userPrompt: '🇦🇷 drop nuevo en 30 minutos',
        })
        expect(prompt).toContain('Memory persistence (explicit signal)')
        expect(prompt).toContain('use your file edit tool to update workspace MEMORY.md')
        expect(prompt).toContain('## Preferred dialect')
        expect(prompt).toContain('Long-term preferences (operator-curated):')
        expect(prompt).toContain('- Preferred Spanish dialect: argentina (set by flag/text hint)')
        // Replace, never duplicate
        expect(prompt).toContain('replace its dialect value')
      })

      it('explicit text hint also emits a persistence-write clause with the matched dialect', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'copy',
          userPrompt: 'haz una línea mexicana para el vault drop',
        })
        expect(prompt).toContain('Memory persistence (explicit signal)')
        expect(prompt).toContain('- Preferred Spanish dialect: mexico (set by flag/text hint)')
      })

      it('no signal emits a persistence-read clause that applies stored dialect', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'announce',
          userPrompt: 'vault update incoming',
        })
        expect(prompt).toContain('Memory persistence (no explicit signal)')
        expect(prompt).toContain('FIRST read workspace MEMORY.md')
        expect(prompt).toContain('Preferred Spanish dialect:')
        expect(prompt).toContain('default to neutral_latam')
        expect(prompt).not.toContain('Memory persistence (explicit signal)')
      })

      it('explicit flag overrides memory and instructs an update for the next turn', () => {
        const directive = _hermitPromptBuildersForTests.buildLanguageDirective('spain')
        // Explicit signal is what makes "this turn" override prior memory.
        expect(directive).toContain('The user signaled the "spain" dialect')
        // Update MEMORY.md so the next turn doesn't need a flag.
        expect(directive).toContain('Memory persistence (explicit signal)')
        expect(directive).toContain('- Preferred Spanish dialect: spain (set by flag/text hint)')
        expect(directive).toContain('overrides any prior memory')
      })

      it('strict JSON output constraint is reinforced alongside the persistence directive', () => {
        const prompt = _hermitPromptBuildersForTests.buildHermit({
          mode: 'announce',
          userPrompt: '🇲🇽 drop nuevo en 30 minutos',
        })
        // Schema preserved
        expect(prompt).toContain('{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}')
        // Strict JSON contract rule shipped with persistence
        expect(prompt).toContain('final assistant message MUST be ONLY the strict JSON object')
        expect(prompt).toContain('any MEMORY.md update must happen as a tool call before the final output')
        // Don't add prose alongside JSON
        expect(prompt).toContain('do not mention it in your final JSON output')
      })

      it('persistence clause is embedded in /meme and /gmeow prompts too', () => {
        const memePrompt = _hermitPromptBuildersForTests.buildImage('🇨🇱 akita en estilo neon')
        const gmeowPrompt = _hermitPromptBuildersForTests.buildGmeow({
          userPrompt: '🇵🇪 gmeow gato risueño',
          memeCaption: 'cat laugh',
          memeTags: ['laugh', 'cat'],
        })
        expect(memePrompt).toContain('Memory persistence (explicit signal)')
        expect(memePrompt).toContain('- Preferred Spanish dialect: chile (set by flag/text hint)')
        expect(gmeowPrompt).toContain('Memory persistence (explicit signal)')
        expect(gmeowPrompt).toContain('- Preferred Spanish dialect: peru (set by flag/text hint)')
      })

      it('persistence clause helper returns the correct shape for every dialect', () => {
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
          const clause = _hermitPromptBuildersForTests.buildMemoryPersistenceClause(dialect)
          expect(clause).toContain('Memory persistence (explicit signal)')
          expect(clause).toContain(`- Preferred Spanish dialect: ${dialect} (set by flag/text hint)`)
          expect(clause).toContain('replace its dialect value')
        }
        const noSignal = _hermitPromptBuildersForTests.buildMemoryPersistenceClause(null)
        expect(noSignal).toContain('Memory persistence (no explicit signal)')
        expect(noSignal).not.toContain('use your file edit tool')
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
      expect(result.reply).toContain('cat laugh')
    })
  })
})
