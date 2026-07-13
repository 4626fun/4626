// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetchMock = vi.fn()
const useSiweAuthMock = vi.fn(() => ({
  authAddress: null as string | null,
  hasSession: false,
  sessionHydrated: true,
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

vi.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: () => useSiweAuthMock(),
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => <div data-testid="page-meta">/rooms</div>,
}))

vi.mock('./AlfaClubKeySafety', () => ({
  AlfaClubKeySafety: ({ roomId }: { roomId?: string }) => (
    <div data-testid="safety-panel">Safety analysis for room {roomId}</div>
  ),
}))

vi.mock('./AlfaClubLiquidityPools', () => ({
  AlfaClubRoomLiquidity: ({ roomId }: { roomId: string }) => (
    <div data-testid="liquidity-panel">Liquidity for room {roomId}</div>
  ),
}))

vi.mock('@/components/alfaclub/CounterTradeStatusPanel', () => ({
  CounterTradeStatusPanel: () => <div data-testid="inverse-panel">Inverse status</div>,
}))

vi.mock('@/components/alfaclub/CreatorCoinLinkPanel', () => ({
  CreatorCoinLinkPanel: ({ roomId }: { roomId: string }) => (
    <div data-testid="creator-coin-link-panel">Creator Coin linking for {roomId}</div>
  ),
}))

vi.mock('@/components/alfaclub/RoomChatPanel', () => ({
  RoomChatPanel: ({ roomId }: { roomId: string }) => (
    <div data-testid="chat-panel">Room chat for {roomId}</div>
  ),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

async function renderHub(url: string) {
  const { AlfaClubTradingRooms } = await import('./AlfaClubTradingRooms')
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AlfaClubTradingRooms />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('AlfaClub room hub behavior', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    apiFetchMock.mockReset()
    useSiweAuthMock.mockReturnValue({
      authAddress: null,
      hasSession: false,
      sessionHydrated: true,
    })
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          rows: [
            {
              roomId: '1659',
              roomName: 'AKITA',
              displayLabel: 'AKITA',
              creatorHandle: 'akita',
              roomType: 'trading',
              tier: 'club',
              keySupply: 100,
              roomPoints: 2500,
              imageUrl: 'https://project.storage.supabase.co/room-1659',
              description: 'Trading and community room',
              featured: true,
              uniqueHolders: 50,
              ingestedAt: '2026-07-12T12:00:00.000Z',
            },
            {
              roomId: '9',
              roomName: 'Room Nine',
              displayLabel: 'Room Nine',
              creatorHandle: null,
              roomType: 'social',
              tier: 'casual',
              keySupply: 10,
              roomPoints: 100,
              imageUrl: null,
              description: 'A social room',
              featured: false,
              uniqueHolders: 8,
              ingestedAt: '2026-07-11T12:00:00.000Z',
            },
          ],
        },
      }),
    })
  })

  it('does not request personalized room holdings during public browsing', async () => {
    await renderHub('/rooms')
    await screen.findAllByText('AKITA')

    expect(
      apiFetchMock.mock.calls.some(([url]) => url === '/api/wallet/friend-key-holdings'),
    ).toBe(false)
  })

  it('requests personalized room holdings after the 4626 session is hydrated', async () => {
    useSiweAuthMock.mockReturnValue({
      authAddress: '0x00000000000000000000000000000000000000aa',
      hasSession: true,
      sessionHydrated: true,
    })

    await renderHub('/rooms')

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(([url]) => url === '/api/wallet/friend-key-holdings'),
      ).toBe(true)
    })
  })

  it('normalizes legacy safety links into the combined overview and exposes inverse for room 1659', async () => {
    await renderHub('/rooms?roomId=1659&tab=safety')

    expect(await screen.findByText('Safety analysis for room 1659')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        '/rooms?roomId=1659&tab=overview',
      )
    })
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('tab', { name: 'Safety' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Inverse' })).toBeTruthy()
  })

  it('syncs tab clicks to the URL and hides inverse for other rooms', async () => {
    await renderHub('/rooms?roomId=9')
    await screen.findByRole('heading', { name: 'Room Nine', level: 1 })

    expect(screen.queryByRole('tab', { name: 'Inverse' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Chat' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Liquidity' }))

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        '/rooms?roomId=9&tab=liquidity',
      )
    })
    expect(screen.getByText('Liquidity for room 9')).toBeTruthy()
  })

  it('renders the chat tab for any room', async () => {
    await renderHub('/rooms?roomId=9&tab=chat')
    await screen.findByRole('heading', { name: 'Room Nine', level: 1 })

    expect(screen.getByRole('tab', { name: 'Chat' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('chat-panel').textContent).toBe('Room chat for 9')
    expect(screen.getByTestId('location').textContent).toBe('/rooms?roomId=9&tab=chat')
  })

  it('normalizes an unavailable inverse deep link to overview', async () => {
    await renderHub('/rooms?roomId=9&tab=inverse')

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/rooms?roomId=9&tab=overview')
    })
  })

  it('presents Room Points without USD formatting and exposes canonical room categories', async () => {
    await renderHub('/rooms?roomId=1659')

    expect(await screen.findAllByText('2.5K pts')).not.toHaveLength(0)
    expect(screen.queryByText('$2,500')).toBeNull()
    expect(screen.getAllByText('Trading Room')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    const roomTypeSelect = screen.getByRole('combobox', { name: 'Room type' }) as HTMLSelectElement
    const tierSelect = screen.getByRole('combobox', { name: 'Bonding curve' }) as HTMLSelectElement
    expect(Array.from(roomTypeSelect.options).map((option) => option.text)).toContain('Social')
    expect(Array.from(tierSelect.options).map((option) => option.text)).toContain('Club')
  })

  it('renders room overview and full safety analysis inline', async () => {
    await renderHub('/rooms?roomId=9')
    await screen.findByRole('heading', { name: 'Room Nine', level: 1 })

    expect(screen.getByRole('heading', { name: 'Room overview', level: 2 })).toBeTruthy()
    expect(screen.getByText('Safety analysis for room 9')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Room overview' })).toBeNull()
  })

  it('shows the trading activity widget for trading rooms only, not social rooms', async () => {
    await renderHub('/rooms?roomId=1659')
    expect(await screen.findByRole('heading', { name: 'PNL & recent trades', level: 2 })).toBeTruthy()

    const socialRender = await renderHub('/rooms?roomId=9')
    await within(socialRender.container).findByRole('heading', { name: 'Room Nine', level: 1 })
    expect(
      within(socialRender.container).queryByRole('heading', { name: 'PNL & recent trades' }),
    ).toBeNull()
  })

  it('keeps the discovery tray and its filters mounted across workspace tabs', async () => {
    await renderHub('/rooms?roomId=1659')
    const search = await screen.findByRole('searchbox', { name: 'Search AlfaClub rooms' })
    fireEvent.change(search, { target: { value: 'AKITA' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Liquidity' }))

    expect(screen.getByRole('searchbox', { name: 'Search AlfaClub rooms' })).toBe(search)
    expect((search as HTMLInputElement).value).toBe('AKITA')
    expect(screen.getByRole('button', { name: 'Collapse room tray' })).toBeTruthy()
  })

  it('restores discovery filters if the host shell remounts on a tab query change', async () => {
    const firstRender = await renderHub('/rooms?roomId=1659')
    const search = await screen.findByRole('searchbox', { name: 'Search AlfaClub rooms' })
    fireEvent.change(search, { target: { value: 'AKITA' } })
    await waitFor(() =>
      expect(window.sessionStorage.getItem('alfaclub:room-discovery-filters:v1')).toContain(
        'AKITA',
      ),
    )
    firstRender.unmount()

    await renderHub('/rooms?roomId=1659&tab=safety')
    expect(
      (await screen.findByRole('searchbox', { name: 'Search AlfaClub rooms' }) as HTMLInputElement)
        .value,
    ).toBe('AKITA')
  })

  it('supports keyboard resizing, collapsing, and persisted tray preferences', async () => {
    await renderHub('/rooms?roomId=9')
    const separator = await screen.findByRole('slider', { name: 'Resize room tray' })

    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(separator.getAttribute('aria-valuenow')).toBe('336')
      expect(window.localStorage.getItem('alfaclub:room-tray-width:v1')).toBe('336')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse room tray' }))
    expect(await screen.findByRole('button', { name: 'Expand room tray' })).toBeTruthy()
    expect(screen.getByLabelText('Selected room #9')).toBeTruthy()
    expect(window.localStorage.getItem('alfaclub:room-tray-collapsed:v1')).toBe('true')
  })

  it('keeps the mobile room drawer trigger available and renders panels inline', async () => {
    await renderHub('/rooms?roomId=9&tab=liquidity')

    expect(
      await screen.findByRole('button', {
        name: /Room Nine Social Room · casual · 100 pts Change/i,
      }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Room liquidity' })).toBeNull()
    expect(screen.getByText('Liquidity for room 9').closest('[hidden]')).toBeNull()
  })

  it('renders remote room artwork directly (CSP allowlists the room image domains)', async () => {
    await renderHub('/rooms?roomId=1659')
    await screen.findByRole('heading', { name: 'AKITA', level: 1 })

    expect(
      Array.from(document.querySelectorAll('img')).some(
        (image) => image.getAttribute('src') === 'https://project.storage.supabase.co/room-1659',
      ),
    ).toBe(true)
  })

  it('shows a compact desktop discovery primer when no room is selected', async () => {
    await renderHub('/rooms')

    expect(
      await screen.findByRole('heading', {
        name: 'Select a room from the discovery rail',
        level: 1,
      }),
    ).toBeTruthy()
    expect(screen.getByText(/↑↓ navigate · Enter open/)).toBeTruthy()
  })
})
