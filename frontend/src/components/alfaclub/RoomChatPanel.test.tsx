// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, useSiweAuthMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  useSiweAuthMock: vi.fn(() => ({ hasSession: true, sessionHydrated: true })),
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: useSiweAuthMock,
}))

import { RoomChatPanel } from './RoomChatPanel'

describe('RoomChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSiweAuthMock.mockReturnValue({ hasSession: true, sessionHydrated: true })
  })

  it('disables the composer for read-only coin viewers', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          messages: [],
          channels: {
            enabled: false,
            telegramEnabled: false,
            xmtpEnabled: false,
            rolloutStatus: 'canary',
          },
          chatAccess: {
            allowed: true,
            reason: 'coin_equivalent',
            canWrite: false,
            walletAddress: '0x1111111111111111111111111111111111111111',
          },
        },
      }),
    })

    render(<RoomChatPanel roomId="1659" />)

    await waitFor(() => {
      expect(
        screen.getByText('Read-only — hold or stake a FriendKey for this room to post.'),
      ).toBeTruthy()
    })

    const composer = screen.getByLabelText('Message') as HTMLTextAreaElement
    expect(composer.disabled).toBe(true)
    expect(composer.placeholder).toBe('FriendKey required to post')
    expect((screen.getByRole('button', { name: /send/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('allows posting when chatAccess.canWrite is true', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            messages: [],
            channels: null,
            chatAccess: {
              allowed: true,
              reason: 'room_key',
              canWrite: true,
              walletAddress: '0x1111111111111111111111111111111111111111',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { message: { messageId: 'm1' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            messages: [],
            channels: null,
            chatAccess: {
              allowed: true,
              reason: 'room_key',
              canWrite: true,
              walletAddress: '0x1111111111111111111111111111111111111111',
            },
          },
        }),
      })

    render(<RoomChatPanel roomId="1659" />)

    const composer = await screen.findByLabelText('Message')
    expect((composer as HTMLTextAreaElement).disabled).toBe(false)
    fireEvent.change(composer, { target: { value: 'gm' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
