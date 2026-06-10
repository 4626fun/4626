/**
 * Per-user Hermit personalization end-to-end behaviour, tested at the
 * `executeHermitCommand` level. These tests assert the priority chain:
 *
 *   explicit flag/text-hint > persisted user preference > default (neutral_latam)
 *
 * and that an explicit signal in one sender's message
 *   (a) drives the prompt for THIS turn,
 *   (b) calls `persistPreference` so the next turn from the same sender
 *       remembers it, and
 *   (c) does NOT mutate the prompt for any other sender.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import { _hermitPromptBuildersForTests, executeHermitCommand } from './skillRouter'

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const
const ROOM = '12345'

describe('executeHermitCommand — per-user personalization', () => {
  let restoreEnv: (() => void) | null = null
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'ok' }) }),
    } as Response)
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.restoreAllMocks()
  })

  it('explicit flag in user message drives the dialect AND calls persistPreference for that sender', async () => {
    const persistPreference = vi.fn(async () => {})

    await executeHermitCommand({
      commandText: '/hermit announce 🇲🇽 drop nuevo en 30 minutos',
      senderAddress: ALICE,
      roomId: ROOM,
      // Mark already-onboarded so we isolate the dialect-write
      // assertion from the new one-time onboarding-nudge write.
      userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      persistPreference,
    })

    expect(persistPreference).toHaveBeenCalledTimes(1)
    expect(persistPreference).toHaveBeenCalledWith({
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'mexico',
      updatedBy: 'hermit.flag',
    })
  })

  it('explicit text hint also persists (updatedBy=hermit.text-hint)', async () => {
    const persistPreference = vi.fn(async () => {})

    await executeHermitCommand({
      commandText: '/hermit copy haz una línea mexicana para el vault drop',
      senderAddress: ALICE,
      roomId: ROOM,
      persistPreference,
    })

    expect(persistPreference).toHaveBeenCalledWith({
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'mexico',
      updatedBy: 'hermit.text-hint',
    })
  })

  it('absence of any signal does NOT touch persistPreference (other than the one-time onboarding nudge)', async () => {
    const persistPreference = vi.fn(async (_params: { preferenceKey: string }) => {})

    await executeHermitCommand({
      commandText: '/hermit announce vault update incoming',
      senderAddress: ALICE,
      roomId: ROOM,
      // Mark already-onboarded so the one-time nudge does not fire.
      userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      persistPreference,
    })

    // No dialect/tone preference write.
    const dialectOrToneWrites = persistPreference.mock.calls.filter((call) =>
      ['hermit.spanish_dialect', 'hermit.tone'].includes(
        (call[0] as unknown as { preferenceKey?: string })?.preferenceKey ?? '',
      ),
    )
    expect(dialectOrToneWrites).toHaveLength(0)
  })

  it('saved preference (no explicit signal) selects that dialect for the prompt', () => {
    const prompt = _hermitPromptBuildersForTests.buildHermit({
      mode: 'announce',
      userPrompt: 'vault update incoming',
      userPreferences: { spanishDialect: 'argentina' },
    })

    expect(prompt).toContain('Spanish dialect: argentina')
    expect(prompt).toContain('Memory persistence (saved preference)')
    expect(prompt).not.toContain('Memory persistence (explicit signal)')
  })

  it('explicit signal trumps a saved preference (priority chain)', () => {
    const prompt = _hermitPromptBuildersForTests.buildHermit({
      mode: 'announce',
      userPrompt: '🇪🇸 lanzamiento nuevo',
      userPreferences: { spanishDialect: 'argentina' },
    })

    expect(prompt).toContain('Spanish dialect: spain')
    expect(prompt).toContain('Memory persistence (explicit signal)')
    expect(prompt).not.toContain('Memory persistence (saved preference)')
  })

  it('falls back to neutral_latam when neither explicit nor persisted dialect is present', () => {
    const prompt = _hermitPromptBuildersForTests.buildHermit({
      mode: 'announce',
      userPrompt: 'vault update incoming',
      userPreferences: { spanishDialect: null },
    })

    expect(prompt).toContain('Spanish dialect: neutral_latam')
    expect(prompt).toContain('no per-user dialect signal')
  })

  it('different sender with no preference is unaffected by another sender\'s explicit signal', async () => {
    // Alice's preference write happens via Alice's persistPreference closure
    // — Bob's executeHermitCommand call (with userPreferences=null) must not
    // see any leakage, since the resolver reads only Bob's row.
    const alicePersist = vi.fn(async () => {})
    const bobPersist = vi.fn(async () => {})

    await executeHermitCommand({
      commandText: '/hermit announce 🇲🇽 drop nuevo',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      persistPreference: alicePersist,
    })

    await executeHermitCommand({
      commandText: '/hermit announce vault update',
      senderAddress: BOB,
      roomId: ROOM,
      // Mark Bob already-onboarded too so the assertion is about
      // dialect leakage, not the one-time onboarding nudge.
      userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      persistPreference: bobPersist,
    })

    expect(alicePersist).toHaveBeenCalledTimes(1)
    expect(bobPersist).not.toHaveBeenCalled()

    // Bob's outbound prompt — extract from the second fetch call — must not
    // mention Mexico or any explicit-signal directive.
    const bobBody = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as { prompt: string }
    expect(bobBody.prompt).toContain('Spanish dialect: neutral_latam')
    expect(bobBody.prompt).not.toContain('Spanish dialect: mexico')
  })

  it('rejects unknown dialect values from a poisoned saved preference (validates with asSpanishDialect)', () => {
    const prompt = _hermitPromptBuildersForTests.buildHermit({
      mode: 'announce',
      userPrompt: 'vault update incoming',
      // Suppose someone stuffed garbage into the table: must not propagate.
      userPreferences: { spanishDialect: 'klingon' as unknown as string },
    })

    expect(prompt).toContain('Spanish dialect: neutral_latam')
    expect(prompt).not.toContain('klingon')
  })

  it('treats the legacy alias puerto_rico as caribbean', () => {
    const prompt = _hermitPromptBuildersForTests.buildHermit({
      mode: 'announce',
      userPrompt: 'vault update incoming',
      userPreferences: { spanishDialect: 'puerto_rico' },
    })
    expect(prompt).toContain('Spanish dialect: caribbean')
  })

  it('persistPreference failure does NOT break the chat reply', async () => {
    const persistPreference = vi.fn(async () => {
      throw new Error('db down')
    })

    const result = await executeHermitCommand({
      commandText: '/hermit announce 🇲🇽 drop nuevo',
      senderAddress: ALICE,
      roomId: ROOM,
      userPreferences: { onboardedAt: '2026-05-01T00:00:00Z' },
      persistPreference,
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('hermit')
    expect(persistPreference).toHaveBeenCalledTimes(1)
  })

  it('explicit signal on /gmeow also drives persistence', async () => {
    const persistPreference = vi.fn(async () => {})

    await executeHermitCommand({
      commandText: '/gmeow 🇨🇱 gato risueño',
      senderAddress: ALICE,
      roomId: ROOM,
      persistPreference,
    })

    expect(persistPreference).toHaveBeenCalledWith({
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'chile',
      updatedBy: 'hermit.flag',
    })
  })

  it('explicit signal on /meme also drives persistence', async () => {
    const persistPreference = vi.fn(async () => {})
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ imagePrompt: 'akita neon', caption: 'wepa' }) }),
    } as Response)

    await executeHermitCommand({
      commandText: '/meme 🇵🇷 akita en estilo neon',
      senderAddress: ALICE,
      roomId: ROOM,
      persistPreference,
    })

    expect(persistPreference).toHaveBeenCalledWith({
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'caribbean',
      updatedBy: 'hermit.flag',
    })
  })

  it('callers without persistPreference still work (no-op, no throw)', async () => {
    const result = await executeHermitCommand({
      commandText: '/hermit announce 🇲🇽 drop nuevo',
      senderAddress: ALICE,
      roomId: ROOM,
    })
    expect(result.kind).toBe('hermit')
  })
})
