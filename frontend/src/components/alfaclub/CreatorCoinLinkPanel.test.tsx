// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, readPoolsMock, signMessageMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  readPoolsMock: vi.fn(),
  signMessageMock: vi.fn(),
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: () => ({ hasSession: true }),
}))

vi.mock('@/wallet/accountContext', () => ({
  useAccountContext: () => ({
    activeAccount: '0x1000000000000000000000000000000000000000',
    signerAddress: '0x1000000000000000000000000000000000000000',
    activeAccountType: 'EOA',
  }),
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => ({}),
  useWalletClient: () => ({ data: { signMessage: signMessageMock } }),
}))

vi.mock('@/config/contracts', () => ({
  CONTRACTS: {
    room1659SudoswapPair: '0x9000000000000000000000000000000000000000',
    alfaClubSudoswapAdapter: '0x9100000000000000000000000000000000000000',
    alfaClubUniversalRouter: '0x9400000000000000000000000000000000000000',
    permit2: '0x9500000000000000000000000000000000000000',
    sudoswapPairFactory: '0x9200000000000000000000000000000000000000',
    sudoswapXykCurve: '0x9300000000000000000000000000000000000000',
  },
}))

vi.mock('@/hooks/useAlfaClubLiquidityPools', () => ({
  isAlfaClubSudoswapMarketConfigured: () => true,
  readAlfaClubLiquidityPools: readPoolsMock,
}))

import { CreatorCoinLinkPanel } from './CreatorCoinLinkPanel'

const COIN = '0x3000000000000000000000000000000000000000'
const EXECUTION = '0x1000000000000000000000000000000000000000'

function response(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 403,
    json: async () => ({
      success: ok,
      data,
      error: ok ? undefined : 'request_failed',
    }),
  } as Response
}

function inspection(status: string) {
  return {
    status,
    roomId: '1659',
    tokenId: '1659',
    creatorCoinAddress: COIN,
    executionAddress: EXECUTION,
    verificationMethod:
      status === 'verified_owner'
        ? 'direct_owner'
        : status === 'managed_by_policy_controller'
          ? 'policy_controller'
          : null,
    verificationBlock: '31337',
    coinName: 'Creator',
    coinSymbol: 'CREATOR',
    coinDecimals: 18,
    owners: [EXECUTION],
    creatorCoinPayoutRecipient: '0x4000000000000000000000000000000000000000',
    policyControllerAddress:
      status === 'managed_by_policy_controller'
        ? '0x5000000000000000000000000000000000000000'
        : null,
    existingLink: null,
  }
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CreatorCoinLinkPanel roomId="1659" onOpenLiquidity={vi.fn()} />
    </QueryClientProvider>,
  )
}

async function validateWithStatus(status: string) {
  apiFetchMock
    .mockResolvedValueOnce(response({ status: null, link: null }))
    .mockResolvedValueOnce(response(inspection(status)))
  renderPanel()
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Base Creator Coin address'), {
    target: { value: COIN },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Validate control' }))
}

describe('CreatorCoinLinkPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readPoolsMock.mockResolvedValue({
      pools: [
        {
          tokenId: 1659n,
          creatorCoin: COIN,
          creatorCoinBalance: 1_000n,
          keyBalance: 10n,
          adapterMarketAllowed: true,
          configurationReady: true,
        },
      ],
      totalPoolCount: 1,
      isTruncated: false,
    })
  })

  it.each([
    ['verified_owner', 'Verified owner'],
    ['managed_by_policy_controller', 'Managed by your 4626 policy controller'],
    ['control_not_verified', 'Control not verified'],
    ['claimed_by_another_account', 'Claimed by another account'],
  ])('renders the %s status from server authority checks', async (status, label) => {
    await validateWithStatus(status)
    expect(await screen.findByText(label)).toBeTruthy()
  })

  it('keeps validation read-only and does not sign or open liquidity', async () => {
    await validateWithStatus('verified_owner')
    expect(await screen.findByText('Verified owner')).toBeTruthy()
    expect(signMessageMock).not.toHaveBeenCalled()
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Open room market' }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('shows official Sudoswap readiness as a separate checklist', async () => {
    apiFetchMock.mockResolvedValueOnce(
      response({
        status: 'verified_owner',
        link: {
          ...inspection('verified_owner'),
          verificationMethod: 'direct_owner',
        },
      }),
    )
    renderPanel()
    expect(await screen.findByText('Market readiness')).toBeTruthy()
    expect(screen.getByText('Execution-ready wallet')).toBeTruthy()
    expect(await screen.findByText('Pair inventory')).toBeTruthy()
    expect(screen.getByText('Adapter market')).toBeTruthy()
    expect(screen.getByText('Official market')).toBeTruthy()
    await waitFor(() => {
      expect(readPoolsMock).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole('button', { name: 'Open room market' }).hasAttribute('disabled'),
      ).toBe(false)
    })
  })
})
