/**
 * Hermit setup / personalization (PR adding /hermit setup, /hermit
 * prefs, /hermit reset, /hermit lang, /hermit tone, plus the one-time
 * onboarding nudge appended to /hermit, /meme, /gmeow replies).
 *
 * Goals:
 *   - Subcommand routing happens before parseHermitDraftMode so the
 *     existing `/hermit tone <message>` draft mode is preserved when
 *     <message> is not a recognised tone name.
 *   - persistPreference / listPreferences / clearPreferences callbacks
 *     are invoked in the documented shape; failure modes never crash
 *     the reply.
 *   - The onboarding nudge is appended exactly once per (room, sender)
 *     and only on AlfaClub-room surfaces (where persistPreference is
 *     wired). It never appears on /hermit setup / prefs / reset / lang
 *     / tone replies.
 *   - Tone preference flows into the Pinata prompt for /hermit, /meme,
 *     /gmeow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  _hermitPromptBuildersForTests,
  asHermitTone,
  executeHermitCommand,
  HERMIT_TONES,
} from './skillRouter'

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const ROOM = '1043'

describe('Hermit setup subcommands', () => {
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

  describe('/hermit setup', () => {
    it('returns a local menu without calling Pinata', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit setup',
        senderAddress: ALICE,
        roomId: ROOM,
      })
      expect(result.provider).toBe('local')
      expect(result.kind).toBe('hermit')
      expect(result.reply).toContain('Hermit setup')
      expect(result.reply).toContain('🇲🇽 Mexican Spanish')
      expect(result.reply).toContain('🇪🇸 European Spanish')
      for (const tone of HERMIT_TONES) {
        expect(result.reply).toContain(tone)
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('does not append the onboarding nudge on the setup reply', async () => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit setup',
        senderAddress: ALICE,
        roomId: ROOM,
        userPreferences: { spanishDialect: null },
        persistPreference: persist,
      })
      expect(result.reply).not.toContain('Want me to remember your style')
      expect(persist).not.toHaveBeenCalled()
    })
  })

  describe('/hermit prefs', () => {
    it('shows a friendly empty-state when nothing is stored', async () => {
      const list = vi.fn(async () => [])
      const result = await executeHermitCommand({
        commandText: '/hermit prefs',
        senderAddress: ALICE,
        roomId: ROOM,
        listPreferences: list,
      })
      expect(result.reply).toContain('no saved preferences')
      expect(list).toHaveBeenCalledTimes(1)
    })

    it('renders saved Hermit preferences as a list', async () => {
      const list = vi.fn(async () => [
        {
          preferenceKey: 'hermit.spanish_dialect',
          preferenceValue: 'argentina',
          updatedAt: '2026-05-01T11:00:00Z',
        },
        {
          preferenceKey: 'hermit.tone',
          preferenceValue: 'degen',
          updatedAt: '2026-05-01T11:05:00Z',
        },
        {
          preferenceKey: 'hermit.onboarded',
          preferenceValue: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        },
      ])
      const result = await executeHermitCommand({
        commandText: '/hermit prefs',
        senderAddress: ALICE,
        roomId: ROOM,
        listPreferences: list,
      })
      expect(result.reply).toContain('Spanish dialect: argentina')
      expect(result.reply).toContain('Tone: degen')
      expect(result.reply).toContain('Onboarded:')
    })

    it('returns a graceful message when listPreferences is unavailable', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit prefs',
        senderAddress: ALICE,
      })
      expect(result.reply).toContain('not available on this surface')
    })

    it('survives a thrown listPreferences (best-effort)', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit prefs',
        senderAddress: ALICE,
        roomId: ROOM,
        listPreferences: vi.fn(async () => {
          throw new Error('db down')
        }),
      })
      expect(result.kind).toBe('hermit')
      expect(result.reply).toContain('no saved preferences')
    })
  })

  describe('/hermit reset', () => {
    it('calls clearPreferences and confirms on success', async () => {
      const clear = vi.fn(async () => true)
      const result = await executeHermitCommand({
        commandText: '/hermit reset',
        senderAddress: ALICE,
        roomId: ROOM,
        clearPreferences: clear,
      })
      expect(clear).toHaveBeenCalledTimes(1)
      expect(result.reply).toContain('preferences cleared')
    })

    it('reports storage unavailable when clearPreferences returns false', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit reset',
        senderAddress: ALICE,
        roomId: ROOM,
        clearPreferences: vi.fn(async () => false),
      })
      expect(result.reply).toContain('storage unavailable')
    })

    it('survives a thrown clearPreferences (best-effort)', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit reset',
        senderAddress: ALICE,
        roomId: ROOM,
        clearPreferences: vi.fn(async () => {
          throw new Error('db boom')
        }),
      })
      expect(result.reply).toContain('storage unavailable')
    })
  })

  describe('/hermit lang', () => {
    it('persists a flag-based language as the spanish_dialect preference', async () => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit lang 🇲🇽',
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: persist,
      })
      expect(persist).toHaveBeenCalledTimes(1)
      expect(persist).toHaveBeenCalledWith({
        preferenceKey: 'hermit.spanish_dialect',
        preferenceValue: 'mexico',
        updatedBy: 'hermit.lang',
      })
      expect(result.reply).toContain('"mexico"')
    })

    it('accepts a text-hint form like "argentino" → "argentina"', async () => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit lang argentino',
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: persist,
      })
      expect(persist).toHaveBeenCalledWith({
        preferenceKey: 'hermit.spanish_dialect',
        preferenceValue: 'argentina',
        updatedBy: 'hermit.lang',
      })
      expect(result.reply).toContain('"argentina"')
    })

    it('accepts a canonical dialect token like "neutral_latam"', async () => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit lang neutral_latam',
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: persist,
      })
      expect(persist).toHaveBeenCalledWith({
        preferenceKey: 'hermit.spanish_dialect',
        preferenceValue: 'neutral_latam',
        updatedBy: 'hermit.lang',
      })
    })

    it('rejects an unknown language without writing', async () => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit lang klingon',
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: persist,
      })
      expect(persist).not.toHaveBeenCalled()
      expect(result.reply).toContain('Unknown language')
    })

    it('treats a bare flag in /hermit (no subcommand) as /hermit lang <flag>', async () => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit 🇪🇸',
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: persist,
      })
      expect(persist).toHaveBeenCalledWith({
        preferenceKey: 'hermit.spanish_dialect',
        preferenceValue: 'spain',
        updatedBy: 'hermit.lang',
      })
      expect(result.provider).toBe('local')
      expect(result.reply).toContain('"spain"')
    })

    it('reports best-effort failure when persistPreference throws', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit lang 🇲🇽',
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: vi.fn(async () => {
          throw new Error('db boom')
        }),
      })
      expect(result.reply).toContain("won't persist yet")
    })
  })

  describe('/hermit tone', () => {
    it.each(HERMIT_TONES.map((t) => [t]))('persists tone "%s"', async (tone) => {
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: `/hermit tone ${tone}`,
        senderAddress: ALICE,
        roomId: ROOM,
        persistPreference: persist,
      })
      expect(persist).toHaveBeenCalledWith({
        preferenceKey: 'hermit.tone',
        preferenceValue: tone,
        updatedBy: 'hermit.tone',
      })
      expect(result.reply).toContain(`"${tone}"`)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('multi-word /hermit tone <message> still falls through to the draft mode', async () => {
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
        HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: '{"line":"sharper line"}' }),
      } as Response)
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit tone make this clearer: we are shipping tonight',
        senderAddress: ALICE,
        roomId: ROOM,
        // Mark already-onboarded so the nudge does not fire and we can
        // assert cleanly that no `hermit.tone` write happened.
        userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
        persistPreference: persist,
      })
      // Multi-word arg contains whitespace/punctuation, so we fall
      // through to the existing tone-mode draft path. The new
      // /hermit tone <name> path would have written hermit.tone; assert
      // that did NOT happen.
      const toneWrites = persist.mock.calls.filter(
        (call) => (call[0] as { preferenceKey: string }).preferenceKey === 'hermit.tone',
      )
      expect(toneWrites).toHaveLength(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.provider).toBe('pinata')
    })

    it('single-token unknown tone returns local "Unknown tone" guidance and does NOT call Pinata', async () => {
      // Regression guard for PR #480 review feedback: previously
      // `/hermit tone galactic` fell through to the Pinata tone draft
      // path and surfaced backend / config errors. The personalization
      // handler should own every single-token /hermit tone arg.
      const persist = vi.fn(async () => {})
      const result = await executeHermitCommand({
        commandText: '/hermit tone galactic',
        senderAddress: ALICE,
        roomId: ROOM,
        userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
        persistPreference: persist,
      })

      expect(result.kind).toBe('hermit')
      expect(result.provider).toBe('local')
      expect(result.reply).toContain('Unknown tone')
      expect(result.reply).toContain('clean')
      expect(result.reply).toContain('See `/hermit setup`')
      // No write happened.
      const toneWrites = persist.mock.calls.filter(
        (call) => (call[0] as { preferenceKey: string }).preferenceKey === 'hermit.tone',
      )
      expect(toneWrites).toHaveLength(0)
      // No Pinata call happened.
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('single-token /hermit tone with no Pinata env still resolves locally (no thrown backend error)', async () => {
      // Without HERMIT_PINATA_CHAT_ENDPOINT / HERMIT_PINATA_BEARER_TOKEN
      // set, falling through to the draft path would have thrown
      // `Hermit Pinata path unavailable.`. Confirm that the local
      // handler intercepts before that happens.
      restoreEnv = applyEnv({
        HERMIT_PINATA_CHAT_ENDPOINT: undefined,
        HERMIT_PINATA_BEARER_TOKEN: undefined,
      })
      const result = await executeHermitCommand({
        commandText: '/hermit tone wat',
        senderAddress: ALICE,
        roomId: ROOM,
        userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      })
      expect(result.provider).toBe('local')
      expect(result.reply).toContain('Unknown tone')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('bare /hermit tone (no arg) returns local "Unknown tone" guidance', async () => {
      const result = await executeHermitCommand({
        commandText: '/hermit tone',
        senderAddress: ALICE,
        roomId: ROOM,
        userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      })
      expect(result.provider).toBe('local')
      expect(result.reply).toContain('Unknown tone')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('asHermitTone', () => {
    it('whitelists known tone names case-insensitively', () => {
      expect(asHermitTone('clean')).toBe('clean')
      expect(asHermitTone('Degen')).toBe('degen')
      expect(asHermitTone(' PRO ')).toBe('pro')
    })

    it('rejects anything not in HERMIT_TONES', () => {
      expect(asHermitTone('galactic')).toBeNull()
      expect(asHermitTone('')).toBeNull()
      expect(asHermitTone(null as unknown as string)).toBeNull()
    })
  })
})

describe('Hermit onboarding nudge', () => {
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

  function setUpPinata(text: string) {
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text }),
    } as Response)
  }

  it('appends the nudge on the very first /hermit reply when not yet onboarded', async () => {
    setUpPinata('Hermit reply')
    const persist = vi.fn(async () => {})
    const result = await executeHermitCommand({
      commandText: '/hermit announce gm',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
      persistPreference: persist,
    })
    expect(result.reply).toContain('Hermit reply')
    expect(result.reply).toContain('Want me to remember your style')
    expect(result.reply).toContain('/hermit setup')
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        preferenceKey: 'hermit.onboarded',
        updatedBy: 'hermit.onboarding',
      }),
    )
  })

  it('does NOT append the nudge when userPreferences.onboardedAt is present', async () => {
    setUpPinata('Hermit reply 2')
    const persist = vi.fn(async () => {})
    const result = await executeHermitCommand({
      commandText: '/hermit announce gm',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { onboardedAt: '2026-05-01T10:00:00Z' },
      persistPreference: persist,
    })
    expect(result.reply).toContain('Hermit reply 2')
    expect(result.reply).not.toContain('Want me to remember your style')
    expect(persist).not.toHaveBeenCalled()
  })

  it('does NOT append the nudge on non-AlfaClub surfaces (no roomId)', async () => {
    setUpPinata('non-room reply')
    const result = await executeHermitCommand({
      commandText: '/hermit announce gm',
      senderAddress: ALICE,
    })
    expect(result.reply).toContain('non-room reply')
    expect(result.reply).not.toContain('Want me to remember your style')
  })

  it('does NOT append the nudge on /hermit setup / prefs / reset / lang replies', async () => {
    const persist = vi.fn(async () => {})

    const setup = await executeHermitCommand({
      commandText: '/hermit setup',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
      persistPreference: persist,
    })
    expect(setup.reply).not.toContain('Want me to remember your style')

    const prefs = await executeHermitCommand({
      commandText: '/hermit prefs',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
      persistPreference: persist,
      listPreferences: vi.fn(async () => []),
    })
    expect(prefs.reply).not.toContain('Want me to remember your style')

    const lang = await executeHermitCommand({
      commandText: '/hermit lang 🇲🇽',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
      persistPreference: persist,
    })
    expect(lang.reply).not.toContain('Want me to remember your style')

    // setup never wrote anything; lang wrote hermit.spanish_dialect;
    // neither path wrote hermit.onboarded.
    const onboardedCalls = persist.mock.calls.filter(
      (call) =>
        (call[0] as { preferenceKey: string }).preferenceKey === 'hermit.onboarded',
    )
    expect(onboardedCalls).toHaveLength(0)
  })

  it('appends the nudge on /gmeow first reply', async () => {
    const persist = vi.fn(async () => {})
    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
      persistPreference: persist,
    })
    expect(result.kind).toBe('gmeow')
    expect(result.reply).toContain('Want me to remember your style')
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ preferenceKey: 'hermit.onboarded' }),
    )
  })

  it('appends the nudge on /meme first reply', async () => {
    setUpPinata('{"imagePrompt":"x","caption":"y","hashtags":["#z"]}')
    const persist = vi.fn(async () => {})
    const result = await executeHermitCommand({
      commandText: '/meme akita',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
      persistPreference: persist,
    })
    expect(result.kind).toBe('meme')
    expect(result.reply).toContain('Want me to remember your style')
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ preferenceKey: 'hermit.onboarded' }),
    )
  })

  it('does not nudge when persistPreference is missing (no surface to write through)', async () => {
    setUpPinata('reply')
    const result = await executeHermitCommand({
      commandText: '/hermit announce gm',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { spanishDialect: null },
    })
    expect(result.reply).not.toContain('Want me to remember your style')
  })
})

describe('Tone in Pinata prompt building', () => {
  const { buildHermit, buildImage, buildGmeow } = _hermitPromptBuildersForTests

  it('omits the Tone clause when no tone is stored', () => {
    const prompt = buildHermit({ mode: 'copy', userPrompt: 'gm' })
    expect(prompt).not.toContain('Tone:')
  })

  it('includes the Tone clause for /hermit when userPreferences.tone is set', () => {
    const prompt = buildHermit({
      mode: 'copy',
      userPrompt: 'gm',
      userPreferences: { tone: 'degen' },
    })
    expect(prompt).toContain('Tone: ')
    expect(prompt).toMatch(/Degen tone/i)
  })

  it('includes the Tone clause for /meme when stored', () => {
    const prompt = buildImage('akita', { tone: 'pro' })
    expect(prompt).toContain('Tone: ')
    expect(prompt).toMatch(/Pro tone/i)
  })

  it('includes the Tone clause for /gmeow when stored', () => {
    const prompt = buildGmeow({
      userPrompt: 'gm',
      memeCaption: 'caption',
      memeTags: ['cat'],
      userPreferences: { tone: 'concise' },
    })
    expect(prompt).toContain('Tone: ')
    expect(prompt).toMatch(/Concise tone/i)
  })

  it('ignores an unknown tone value (whitelist)', () => {
    const prompt = buildHermit({
      mode: 'copy',
      userPrompt: 'gm',
      userPreferences: { tone: 'galactic' },
    })
    expect(prompt).not.toContain('Tone:')
  })
})
