import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('./apiBase', () => ({
  apiFetch: apiFetchMock,
}))

import { generateAgentCreative } from './agentCreative'

function makeResponse(params: {
  ok: boolean
  status?: number
  payload: unknown
}): Response {
  return {
    ok: params.ok,
    status: params.status ?? (params.ok ? 200 : 500),
    json: async () => params.payload,
  } as Response
}

describe('agentCreative', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns strict success creative envelope', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          ok: true,
          mode: 'referral_og',
          version: 'v1',
          voice: 'premium_dark_crypto',
          result: {
            headline: '@akita · Supporter Access',
            subheadline: 'Creator Vault creative.',
            cta: 'Open Supporter Card',
            visual_direction: ['obsidian', 'metallic'],
            keywords: ['creator vault', 'supporter'],
          },
        },
      }),
    )

    const envelope = await generateAgentCreative({
      mode: 'referral_og',
      context: { handle: 'akita', campaign: 'creator-vault', tier: 'supporter' },
    })

    expect(envelope.ok).toBe(true)
    expect(envelope.mode).toBe('referral_og')
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/agent/creative',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('returns missing context envelope', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          ok: false,
          mode: 'referral_og',
          version: 'v1',
          error: 'missing_required_context',
          missing: ['campaign', 'tier'],
        },
      }),
    )

    const envelope = await generateAgentCreative({
      mode: 'referral_og',
      context: { handle: 'akita' },
    })

    expect(envelope).toEqual({
      ok: false,
      mode: 'referral_og',
      version: 'v1',
      error: 'missing_required_context',
      missing: ['campaign', 'tier'],
    })
  })

  it('surfaces API error for non-OK responses', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: false,
        status: 400,
        payload: {
          success: false,
          error: 'Invalid request body',
        },
      }),
    )

    await expect(
      generateAgentCreative({
        mode: 'share_page_copy',
        context: {},
      }),
    ).rejects.toThrow('Invalid request body')
  })

  it('rejects invalid creative payload shape', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          mode: 'referral_og',
          input: { handle: 'akita' },
          output: { title: 'bad-wrapper' },
        },
      }),
    )

    await expect(
      generateAgentCreative({
        mode: 'referral_og',
        context: { handle: 'akita' },
      }),
    ).rejects.toThrow('Creative response shape was invalid')
  })

  it('rejects success payload when result does not match mode schema', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          ok: true,
          mode: 'referral_og',
          version: 'v1',
          voice: 'premium_dark_crypto',
          result: {
            title: 'Wrong result shape',
          },
        },
      }),
    )

    await expect(
      generateAgentCreative({
        mode: 'referral_og',
        context: { handle: 'akita', campaign: 'creator-vault', tier: 'supporter' },
      }),
    ).rejects.toThrow('Creative response result did not match mode schema')
  })

  it('rejects success payload with unexpected top-level keys', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          ok: true,
          mode: 'referral_og',
          version: 'v1',
          voice: 'premium_dark_crypto',
          result: {
            headline: '@akita · Supporter Access',
            subheadline: 'Creator Vault creative.',
            cta: 'Open Supporter Card',
            visual_direction: ['obsidian', 'metallic'],
            keywords: ['creator vault', 'supporter'],
          },
          extra: 'not allowed',
        },
      }),
    )

    await expect(
      generateAgentCreative({
        mode: 'referral_og',
        context: { handle: 'akita', campaign: 'creator-vault', tier: 'supporter' },
      }),
    ).rejects.toThrow('Creative response envelope contained unexpected fields')
  })
})
