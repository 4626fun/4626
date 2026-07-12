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
  formatAlfaClubPoolFee: () => '0.69%',
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => null,
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

vi.mock('@/config/contracts', () => ({
  CONTRACTS: {
    alfaCreatorKeyLpFactory: '0x0000000000000000000000000000000000000000',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
}))

vi.mock('@/pages/AlfaClubLiquidity', () => ({
  AlfaClubLiquidity: () => <div data-testid="lp-console">console</div>,
}))

vi.mock('@/app/routeGuards', () => ({
  SmartWalletRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/layout/AppLoadingOverlay', () => ({
  AppLoadingRegistrar: () => <div data-testid="loading">loading</div>,
}))

describe('AlfaClubLiquidityPools write gate', () => {
  it('keeps the directory public and blocks the write console without accepted access', async () => {
    const { AlfaClubLiquidityPools } = await import('@/pages/AlfaClubLiquidityPools')
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
      <MemoryRouter>
        <AccessContext.Provider value={access}>
          <AlfaClubLiquidityPools />
        </AccessContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Liquidity pools')).toBeTruthy()
    expect(screen.getByText(/Liquidity writes require access/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Sign in to manage liquidity/i })).toBeTruthy()
    expect(screen.queryByTestId('lp-console')).toBeNull()
  })
})
