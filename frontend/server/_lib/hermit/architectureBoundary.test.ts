import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'

/**
 * Architecture invariants for the Hermit / Pinata creative lane.
 *
 * The recommended deployment shape splits AlfaClub responsibilities:
 *
 *   - Vercel cron owns AlfaClub auth + bridge control plane.
 *   - Supabase stores shared AlfaClub runtime token state
 *     (alfaclub_runtime_secret).
 *   - Pinata / Hermit owns only creative behavior — `/hermit`, `/meme`,
 *     `/gmeow`, persona / memory seed files.
 *
 * These tests are guard-rails: they fail loudly if the Hermit creative
 * lane ever starts importing token-store helpers or otherwise crossing
 * into the AlfaClub auth lane.
 */

const upsertChatMock = vi.fn()
const upsertAccessMock = vi.fn()
const upsertRefreshMock = vi.fn()
const startRefresherMock = vi.fn()
const runOnceRefresherMock = vi.fn()

vi.mock('../alfaclub/chatTokenStore.js', async () => {
  const actual = await vi.importActual<typeof import('../alfaclub/chatTokenStore.js')>(
    '../alfaclub/chatTokenStore.js',
  )
  return {
    ...actual,
    upsertAlfaClubChatToken: upsertChatMock,
    upsertAlfaClubPrivyAccessToken: upsertAccessMock,
    upsertAlfaClubPrivyRefreshToken: upsertRefreshMock,
  }
})

vi.mock('../alfaclub/privyTokenRefresher.js', async () => {
  const actual = await vi.importActual<typeof import('../alfaclub/privyTokenRefresher.js')>(
    '../alfaclub/privyTokenRefresher.js',
  )
  return {
    ...actual,
    startAlfaClubPrivyTokenRefresher: startRefresherMock,
    runAlfaClubPrivyRefreshOnce: runOnceRefresherMock,
  }
})

describe('hermit creative lane — architecture boundary', () => {
  const here = dirname(fileURLToPath(import.meta.url))

  /**
   * Strip multi-line block comments and full-line `//` comments so that
   * doc strings explaining the boundary (which legitimately mention the
   * forbidden auth symbols) do not trip the symbol-presence guard. We
   * only want to flag *real code* references.
   */
  function stripComments(src: string): string {
    const withoutBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '')
    return withoutBlocks
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
  }

  const skillRouterSource = stripComments(
    readFileSync(resolve(here, 'skillRouter.ts'), 'utf8'),
  )
  const policySource = stripComments(readFileSync(resolve(here, 'policy.ts'), 'utf8'))
  const memeStoreSource = stripComments(readFileSync(resolve(here, 'memeStore.ts'), 'utf8'))
  const repositorySource = stripComments(readFileSync(resolve(here, 'repository.ts'), 'utf8'))

  const sources: Array<{ name: string; src: string }> = [
    { name: 'skillRouter.ts', src: skillRouterSource },
    { name: 'policy.ts', src: policySource },
    { name: 'memeStore.ts', src: memeStoreSource },
    { name: 'repository.ts', src: repositorySource },
  ]

  const forbiddenAuthSymbols = [
    'chatTokenStore',
    'upsertAlfaClubChatToken',
    'upsertAlfaClubPrivyAccessToken',
    'upsertAlfaClubPrivyRefreshToken',
    'readAlfaClubChatToken',
    'readAlfaClubPrivyAccessToken',
    'readAlfaClubPrivyRefreshToken',
    'startAlfaClubPrivyTokenRefresher',
    'runAlfaClubPrivyRefreshOnce',
    'privyTokenRefresher',
    'alfaclub_runtime_secret',
  ]

  for (const { name, src } of sources) {
    for (const symbol of forbiddenAuthSymbols) {
      it(`${name} does not reference '${symbol}' in non-comment code`, () => {
        expect(src).not.toContain(symbol)
      })
    }
  }

  it('skillRouter.ts only depends on hermit-local + ws (no alfaclub auth imports)', () => {
    const importLines = skillRouterSource
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]\.\.\/alfaclub\/(?:chatTokenStore|privyTokenRefresher|userPreferenceStore|chatBridge|chatIngestStore|feedbackRelayer)\.js['"]/)
      expect(line).not.toMatch(/chatTokenStore/)
      expect(line).not.toMatch(/privyTokenRefresher/)
    }
  })

  it('skillRouter.ts has the explicit boundary comment', () => {
    const rawSource = readFileSync(resolve(here, 'skillRouter.ts'), 'utf8')
    expect(rawSource).toContain('Hermit creative lane — strict architectural boundary.')
    expect(rawSource).toContain('It must not:')
  })
})

describe('hermit creative lane — runtime invariants', () => {
  let restoreEnv: (() => void) | null = null
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
    upsertChatMock.mockReset()
    upsertAccessMock.mockReset()
    upsertRefreshMock.mockReset()
    startRefresherMock.mockReset()
    runOnceRefresherMock.mockReset()
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.restoreAllMocks()
  })

  it('does not call any chatTokenStore writer when /hermit succeeds', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'hermit reply' }),
    } as Response)

    const { executeHermitCommand } = await import('./skillRouter')
    const result = await executeHermitCommand({
      commandText: '/hermit announce vault update',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(result.kind).toBe('hermit')

    expect(upsertChatMock).not.toHaveBeenCalled()
    expect(upsertAccessMock).not.toHaveBeenCalled()
    expect(upsertRefreshMock).not.toHaveBeenCalled()
  })

  it('does not start the in-process Privy refresher when running creative commands', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED: undefined,
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'meme prompt' }),
    } as Response)

    const { executeHermitCommand } = await import('./skillRouter')
    await executeHermitCommand({
      commandText: '/meme akita black cat',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(startRefresherMock).not.toHaveBeenCalled()
    expect(runOnceRefresherMock).not.toHaveBeenCalled()
  })
})
