// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AccessContext, type AccessState } from '@/app/accessShared'

vi.mock('@/hooks/useAlfaClubLiquidityPools', () => ({
  useAlfaClubLiquidityPools: () => ({
    data: { pools: [], totalPoolCount: 0, isTruncated: false },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  filterAlfaClubLiquidityPools: () => [],
  filterAlfaClubLiquidityPoolsByRoomId: () => [],
  formatAlfaClubPoolFee: () => '6.9%',
  isAlfaClubSudoswapMarketConfigured: () => false,
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => null,
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

vi.mock('@/config/contracts', () => ({
  CONTRACTS: {
    room1659SudoswapPair: '0x0000000000000000000000000000000000000000',
    alfaClubSudoswapAdapter: '0x0000000000000000000000000000000000000000',
    alfaClubUniversalRouter: '0x0000000000000000000000000000000000000000',
    permit2: '0x0000000000000000000000000000000000000000',
    sudoswapPairFactory: '0x0000000000000000000000000000000000000000',
    sudoswapXykCurve: '0x0000000000000000000000000000000000000000',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
}))

vi.mock('@/pages/AlfaClubLiquidity', () => ({
  AlfaClubLiquidity: ({ initialMode }: { initialMode: string }) => (
    <div data-testid="market-console">{initialMode}</div>
  ),
}))

vi.mock('@/app/routeGuards', () => ({
  SmartWalletRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/components/layout/AppLoadingOverlay', () => ({
  AppLoadingRegistrar: () => <div data-testid="loading">loading</div>,
}))

vi.mock('@/components/account/ConnectButton', () => ({
  ConnectButton: () => <button type="button">Connect</button>,
}))

describe('AlfaClubLiquidityPools write gate', () => {
  it('keeps the directory public and blocks the write console without accepted access', async () => {
    const { AlfaClubLiquidityPools } = await import(
      '@/pages/AlfaClubLiquidityPools'
    )
    const access: AccessState = {
      loading: false,
      walletConnected: false,
      sessionValid: false,
      accepted: false,
      creator: false,
      admin: false,
      allowlistEnforced: true,
      effectiveAddress: null,
      marketingUrl: 'https://4626.fun',
      hostMode: 'alfaclub',
    }

    render(
      <MemoryRouter initialEntries={['/keys?keyId=1659&tab=liquidity']}>
        <AccessContext.Provider value={access}>
          <AlfaClubLiquidityPools />
        </AccessContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Key markets')).toBeTruthy()
    expect(
      screen.getByText(/Secondary FriendKey trading settles in-app on official Sudoswap/i),
    ).toBeTruthy()
    expect(screen.getByTestId('eth-to-room-route')).toBeTruthy()
    expect(screen.getByText('ETH funding path (planned)')).toBeTruthy()
    expect(screen.getByText('FriendKey #1659')).toBeTruthy()
    expect(
      screen.getByText(/settle the official Room 1659 Sudoswap v2 pool/i),
    ).toBeTruthy()
    expect(
      screen.getByText(/wraps ETH to WETH for canonical sponsored wallets/i),
    ).toBeTruthy()
    expect(screen.getByText(/Connect to trade/i)).toBeTruthy()
    expect(screen.getAllByTestId('markets-connect').length).toBeGreaterThan(0)
    expect(
      screen
        .getByRole('link', { name: /Sign in to trade/i })
        .getAttribute('href'),
    ).toBe(
      'https://4626.fun/waitlist?continue=alfaclub&returnPath=%2Fkeys%3FkeyId%3D1659%26tab%3Dliquidity',
    )
    expect(screen.queryByTestId('market-console')).toBeNull()
  })

  it.each(['buy', 'buyWithEth', 'sell'] as const)(
    'passes accepted sessions into the SmartWalletRoute %s console',
    async (initialMode) => {
      const { AlfaClubLpWriteConsole } = await import(
        '@/pages/AlfaClubLiquidityPools'
      )
      const access: AccessState = {
        loading: false,
        walletConnected: true,
        sessionValid: true,
        accepted: true,
        creator: false,
        admin: false,
        allowlistEnforced: true,
        effectiveAddress: '0x1000000000000000000000000000000000000000',
        marketingUrl: 'https://4626.fun',
        hostMode: 'alfaclub',
      }

      render(
        <MemoryRouter>
          <AccessContext.Provider value={access}>
            <AlfaClubLpWriteConsole
              selectedPool={
                {
                  pool: '0x2000000000000000000000000000000000000000',
                  creatorCoin: '0x3000000000000000000000000000000000000000',
                  tokenId: 1659n,
                  configurationReady: true,
                } as never
              }
              initialMode={initialMode}
            />
          </AccessContext.Provider>
        </MemoryRouter>,
      )

      expect(screen.getByTestId('market-console').textContent).toBe(initialMode)
      expect(screen.queryByText(/Market trades require access/i)).toBeNull()
    },
  )
})
