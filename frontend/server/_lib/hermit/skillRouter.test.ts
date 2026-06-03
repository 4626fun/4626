import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  _hermitPromptBuildersForTests,
  executeHermitCommand,
  pinataEndpointSupportsHttpDraft,
  shouldPreferPinataHttpDraft,
  shouldRequestPinataGmeowCaption,
} from './skillRouter'
import * as arenaStore from '../arena/arenaIdentityMappingStore.js'
import * as arenaClient from '../arena/arenaClient.js'

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
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Hermit from Pinata' }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/hermit gm',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.provider).toBe('hermit')
    expect(result.kind).toBe('hermit')
    expect(result.reply).toBe('Hermit from Pinata')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects /hermit when pinata path is not configured', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: undefined,
      HERMIT_AGENT_BEARER_TOKEN: undefined,
    })

    await expect(
      executeHermitCommand({
        commandText: '/hermit gm',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).rejects.toThrow('Hermit agent path unavailable')
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

  it('supports /market market-scope command', async () => {
    const result = await executeHermitCommand({
      commandText: '/market',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Market scope|temporarily unavailable/)
  })

  it('supports /signal position-aware command', async () => {
    const result = await executeHermitCommand({
      commandText: '/signal',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('Entry / Exit signal')
  })

  it('supports /position chart timeline command in room contexts', async () => {
    const result = await executeHermitCommand({
      commandText: '/position chart',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('Position timeline chart')
    expect(result.reply).toContain('/position marker <n>')
  })

  it('supports /position markers all in room contexts', async () => {
    const result = await executeHermitCommand({
      commandText: '/position markers all',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Timeline markers|No timeline markers found/)
  })

  it('supports /position marker <n> detail command in room contexts', async () => {
    const result = await executeHermitCommand({
      commandText: '/position marker 1',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Marker #1|not found|No timeline markers found/)
  })

  it('supports /position marker latest alias', async () => {
    const result = await executeHermitCommand({
      commandText: '/position marker latest',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Marker #|No latest marker found|No timeline markers found/)
  })

  it('supports /position marker trade 1 alias', async () => {
    const result = await executeHermitCommand({
      commandText: '/position marker trade 1',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Marker #|Trade marker #1 not found|No timeline markers found/)
  })

  it('supports /position marker host 1 alias', async () => {
    const result = await executeHermitCommand({
      commandText: '/position marker host 1',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Marker #|Host marker #1 not found|No timeline markers found/)
  })

  it('supports /position host markers in room contexts', async () => {
    const result = await executeHermitCommand({
      commandText: '/position host markers',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Host chat markers|No host chat markers found/)
  })

  it('supports /position sender me in room contexts', async () => {
    const result = await executeHermitCommand({
      commandText: '/position sender me',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toMatch(/Sender chat markers|No chat markers found/)
  })

  it('rejects invalid /position sender filter', async () => {
    const result = await executeHermitCommand({
      commandText: '/position sender not-an-address',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })

    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('Invalid sender filter')
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

  it('supports /arena identity show with resolver fallback', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
    })
    const result = await executeHermitCommand({
      commandText: '/arena identity show',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
    })
    expect(result.kind).toBe('hermit')
    expect(result.provider).toBe('local')
    expect(result.reply).toContain('Arena identity resolution')
    expect(result.reply).toContain('source:')
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

  it('supports /arena register (supplied ids) + runs onboard sequence (dry); bind may be no-op in unit harness without DB', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
      ARENA_CREATION_ENABLED: '1',
    })
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
    // Use ids that differ from the env defaults so we exercise the bind + sequence path
    // (instead of the new already-bound short-circuit).
    const result = await executeHermitCommand({
      commandText: '/arena register 11111111-2222-3333-4444-555555555555 0x1111111111111111111111111111111111111111',
      senderAddress: sender,
      roomId: '1659',
    })
    expect(result.reply).toContain('Arena register (supplied ids)')
    // In the unit test env (no real getDb) upsert returns false, so we get the 'failed' note but still execute the sequence + surface ids/sender
    expect(result.reply).toContain('Identity bind failed')
    expect(result.reply).toContain(sender)
    expect(result.reply).toContain('join=')
    expect(result.reply).toContain('activate=')
    expect(result.reply).toContain('add-api-wallet=')
    expect(result.reply).toContain('[dry]')
    expect(result.reply).toContain('11111111')
  })

  it('supports /arena register (no ids) create path: creates, auto-binds as personal mine + onboards (dry)', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
      ARENA_CREATION_ENABLED: '1',
    })
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
    const result = await executeHermitCommand({
      commandText: '/arena register',
      senderAddress: sender,
      roomId: '1659',
    })
    // In plain dry (no mock), create returns no parsable ids → guidance path.
    // (See the mocked-success test below for the auto-bind + onboard path.)
    expect(result.reply.toLowerCase()).toContain('register')
    expect(result.reply).toContain('app.virtuals.io/acp/new')
    expect(result.reply.toLowerCase()).toContain('claim')
    expect(result.reply).not.toContain('Identity bound')
    expect(result.reply).not.toContain('join=')
  })

  it('create path /arena register (no ids) with successful acp parse auto-binds + onboards (mocked)', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '0', // pretend live
      ARENA_CREATION_ENABLED: '1',
    })
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'

    const createSpy = vi.spyOn(arenaClient, 'runArenaCreateAgent').mockResolvedValue({
      ok: true,
      agentId: 'mock-created-agent-uuid-1234',
      agentWalletAddress: '0x3333333333333333333333333333333333333333',
      run: { dryRun: false, stdout: 'success' } as any,
    } as any)

    const result = await executeHermitCommand({
      commandText: '/arena register',
      senderAddress: sender,
      roomId: '1659',
    })

    expect(result.reply).toContain('Created agent via acp and bound as personal')
    expect(result.reply).toContain('mock-created-agent-uuid-1234')
    expect(result.reply).toContain('0x3333333333333333333333333333333333333333')
    expect(result.reply).toContain('join=')
    expect(result.reply.toLowerCase()).toContain('claim') // note for web if full ownership needed

    createSpy.mockRestore()
  })

  it('rejects /arena register outside allowed rooms (same gate as other subs)', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
    })
    const result = await executeHermitCommand({
      commandText: '/arena register',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1043',
    })
    expect(result.reply).toContain('only enabled in approved rooms')
  })

  it('supports /arena register default (supplied ids) to change room default + onboard', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
    })
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9' // operator-like
    const agentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const agentWallet = '0x4444444444444444444444444444444444444444'

    // Mock to simulate successful default set
    const upsertSpy = vi.spyOn(arenaStore, 'upsertArenaIdentityMapping').mockResolvedValue(true)

    const result = await executeHermitCommand({
      commandText: `/arena register default ${agentId} ${agentWallet}`,
      senderAddress: sender,
      roomId: '1659',
    })

    expect(result.reply).toContain('Arena room default register (supplied ids)')
    expect(result.reply).toContain('Room default mapping saved/updated')
    expect(result.reply).toContain('join=ok[dry]')
    expect(result.reply).toContain(agentId)
    expect(result.reply).toContain(agentWallet)

    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      senderAddress: '*', // room default
      arenaAgentId: agentId,
    }))

    upsertSpy.mockRestore()
  })

  it('short-circuits /arena register (supplied ids) when ids already match resolved for sender (already-bound case)', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
      ARENA_AGENT_ID: '019e82af-2e66-7645-af23-69e9f14351f4',
      ARENA_AGENT_WALLET_ADDRESS: '0x30068c6bccf43e9eb5cdb68fb978f32f744d870c',
    })
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
    // Use explicit env ids (no longer hardcoded in config) so the already-bound short-circuit matches the resolved env fallback
    const result = await executeHermitCommand({
      commandText: '/arena register 019e82af-2e66-7645-af23-69e9f14351f4 0x30068c6bccf43e9eb5cdb68fb978f32f744d870c',
      senderAddress: sender,
      roomId: '1659',
    })
    expect(result.reply).toContain('Already bound for your sender')
    expect(result.reply).not.toContain('Identity bind failed')
    expect(result.reply).not.toContain('join=')
  })

  it('supports full happy-path /arena register (supplied ids) with successful bind + onboard (mocked DB)', async () => {
    restoreEnv = applyEnv({
      ARENA_ENABLED: '1',
      ARENA_DGCLAW_DIR: '/tmp',
      ARENA_DRY_RUN: '1',
    })
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
    const agentId = '12345678-1234-5678-90ab-cdef12345678'
    const agentWallet = '0x2222222222222222222222222222222222222222'

    // Mock successful DB operations for E2E-like coverage of the bind path
    const resolveSpy = vi.spyOn(arenaStore, 'resolveArenaIdentityForContext').mockResolvedValue({
      source: 'user',
      roomId: '1659',
      senderAddress: sender,
      agentId: null, // different so no short-circuit
      agentWalletAddress: null,
      hlApiWalletAddress: null,
    })
    const upsertSpy = vi.spyOn(arenaStore, 'upsertArenaIdentityMapping').mockResolvedValue(true)

    const result = await executeHermitCommand({
      commandText: `/arena register ${agentId} ${agentWallet}`,
      senderAddress: sender,
      roomId: '1659',
    })

    expect(result.reply).toContain('Arena register (supplied ids):')
    expect(result.reply).toContain('Identity bound for \'mine\'')
    expect(result.reply).toContain(sender)
    expect(result.reply).toContain('join=ok[dry]')
    expect(result.reply).toContain('activate=ok[dry]')
    expect(result.reply).toContain('add-api-wallet=ok[dry]')
    expect(result.reply).toContain(agentId)
    expect(result.reply).toContain(agentWallet)

    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      roomId: '1659',
      senderAddress: sender,
      arenaAgentId: agentId,
      arenaWalletAddress: agentWallet,
    }))

    resolveSpy.mockRestore()
    upsertSpy.mockRestore()
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
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
    expect(result.provider).toBe('hermit')
    expect(result.reply).toContain('fresh cave energy.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses pinata for /gmeow when user supplies a prompt (default policy)', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ line: 'custom cat line.' }) }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/gmeow moon mission',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.provider).toBe('hermit')
    expect(result.reply).toContain('custom cat line.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses hermit provider for /gmeow when HERMIT_GMEOW_HERMIT_CAPTION=always', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_HERMIT_CAPTION: 'always',
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
    expect(result.provider).toBe('hermit')
    expect(result.reply).toContain('cat laugh alpha unlocked.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses HTTP draft (not gateway) for AlfaClub bridge /gmeow on non-Pinata draft endpoints', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://draft.example/v1/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_HERMIT_CAPTION: 'always',
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
    expect(result.provider).toBe('hermit')
    expect(result.reply).toContain('bridge-safe cat laugh.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://draft.example/v1/chat')
  })

  it('shouldPreferPinataHttpDraft defaults to HTTP for bridge-runner on generic endpoints', () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
    })
    expect(
      shouldPreferPinataHttpDraft({
        sourceIdentity: 'alfaclub-bridge-runner',
        prompt: 'casual meme caption only',
      }),
    ).toBe(true)
  })

  it('shouldPreferPinataHttpDraft stays HTTP-only for hosted endpoints', () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
    })
    expect(
      shouldPreferPinataHttpDraft({
        sourceIdentity: 'alfaclub-bridge-runner',
        prompt: 'casual meme caption only',
      }),
    ).toBe(true)
  })

  it('pinataEndpointSupportsHttpDraft accepts hosted HTTPS endpoints', () => {
    expect(pinataEndpointSupportsHttpDraft('https://x7lmjaxx.agents.pinata.cloud')).toBe(true)
    expect(pinataEndpointSupportsHttpDraft('https://pinata.example/chat')).toBe(true)
  })

  it('shouldPreferPinataHttpDraft is false when endpoint is unset', () => {
    restoreEnv = applyEnv({})
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
    restoreEnv = applyEnv({ HERMIT_GMEOW_HERMIT_CAPTION: '0' })
    expect(shouldRequestPinataGmeowCaption('')).toBe(false)
    restoreEnv = applyEnv({ HERMIT_GMEOW_HERMIT_CAPTION: 'local' })
    expect(shouldRequestPinataGmeowCaption('moon')).toBe(false)
    restoreEnv = applyEnv({ HERMIT_GMEOW_HERMIT_CAPTION: 'prompt' })
    expect(shouldRequestPinataGmeowCaption('')).toBe(false)
    expect(shouldRequestPinataGmeowCaption('moon')).toBe(true)
  })

  it('/gmeow falls back to local caption when pinata returns provider auth error text', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_HERMIT_CAPTION: 'always',
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
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_HERMIT_CAPTION: 'always',
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
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      HERMIT_GMEOW_HERMIT_CAPTION: 'always',
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
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Akita cat meme prompt' }),
    } as Response)

    const result = await executeHermitCommand({
      commandText: '/meme akita black cat',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.provider).toBe('hermit')
    expect(result.kind).toBe('meme')
    expect(result.imagePrompt).toBe('Akita cat meme prompt')
  })

  it('formats structured JSON from pinata for /hermit', async () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
      HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
      HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
      HERMIT_AGENT_CHAT_ENDPOINT: undefined,
      HERMIT_AGENT_BEARER_TOKEN: undefined,
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
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
      expect(result.provider).toBe('hermit')
      expect(result.reply).toContain('El vault acaba de despegar.')
      expect(result.reply).toContain('CTA: Reclama tu drop.')
      expect(result.reply).toContain('#4626 #AlfaClub')
      expect(result.reply).not.toContain('```')
    })

    it('passes Spanish JSON values straight through for /meme', async () => {
      restoreEnv = applyEnv({
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
      expect(result.provider).toBe('hermit')
      expect(result.reply).toContain('El vault ya despegó, dale.')
      expect(result.reply).toContain('CTA: Reclamá tu drop.')
      expect(result.reply).not.toContain('```')
    })
  })

  describe('Pinata HTTP fallback timeout', () => {
    it('passes an AbortSignal when calling the Pinata HTTP endpoint', async () => {
      restoreEnv = applyEnv({
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
        HERMIT_AGENT_HTTP_TIMEOUT_MS: '5000',
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
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
      })
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      await expect(
        executeHermitCommand({
          commandText: '/hermit copy gm',
          senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }),
      ).rejects.toThrow('Hermit agent path unavailable')
    })

    it('/gmeow degrades to local meme when the HTTP endpoint throws', async () => {
      restoreEnv = applyEnv({
        HERMIT_AGENT_CHAT_ENDPOINT: 'https://hermit.internal/chat',
        HERMIT_AGENT_BEARER_TOKEN: 'token-abc',
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
