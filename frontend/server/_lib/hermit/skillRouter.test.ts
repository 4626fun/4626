import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import { executeHermitCommand } from './skillRouter'

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
    expect(result.mediaAttachments).toEqual([
      {
        url: 'https://4626.fun/ipfs/bafybeiaj73ww23xkpuvrptykhu5ukcykd6w3fe5juc3zl6elzfz7tbj2jq?filename=catlaugh.gif',
        type: 'tenor-gif',
      },
    ])
  })

  it('returns the bundled cat laugh meme for /gmeow laugh', async () => {
    const result = await executeHermitCommand({
      commandText: '/gmeow laugh',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(result.kind).toBe('gmeow')
    expect(result.reply).toContain('cat laugh')
    expect(result.mediaAttachments).toEqual([
      {
        url: 'https://4626.fun/ipfs/bafybeiaj73ww23xkpuvrptykhu5ukcykd6w3fe5juc3zl6elzfz7tbj2jq?filename=catlaugh.gif',
        type: 'tenor-gif',
      },
    ])
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

})
