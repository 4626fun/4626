// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'

const {
  VAULT,
  TOKEN,
  DEPOT,
  mockEnsureDepot,
  mockApprove,
  mockDeposit,
  mockClaim,
  contractsState,
  hookState,
} = vi.hoisted(() => {
  const VAULT = '0x1111111111111111111111111111111111111111'
  const TOKEN = '0x2222222222222222222222222222222222222222'
  const DEPOT = '0x3333333333333333333333333333333333333333'
  const mockEnsureDepot = vi.fn()
  const mockApprove = vi.fn()
  const mockDeposit = vi.fn()
  const mockClaim = vi.fn()
  const contractsState = {
    bribesFactory4626: '0x4444444444444444444444444444444444444444' as `0x${string}` | undefined,
    ve4626GaugeVoting: '0x5555555555555555555555555555555555555555' as `0x${string}` | undefined,
  }
  const base = () => ({
    depot: DEPOT,
    currentEpoch: 3 as number | undefined,
    claimEpoch: 2 as number | undefined,
    canReceiveBribes: true,
    currentEpochTotalBribes: 1_000_000_000_000_000_000n,
    epochTotalBribes: 500_000_000_000_000_000n,
    hasClaimed: false,
    claimPreview: 250_000_000_000_000_000n,
    tokenDecimals: 18,
    tokenSymbol: 'RWD' as string | undefined,
    tokenAllowance: 0n,
    tokenBalance: 10_000_000_000_000_000_000n,
    ensureDepot: mockEnsureDepot,
    approveToken: mockApprove,
    depositBribe: mockDeposit,
    claimBribe: mockClaim,
    isPending: false,
    txSuccess: false,
    pendingTxHash: undefined as `0x${string}` | undefined,
  })
  return {
    VAULT,
    TOKEN,
    DEPOT,
    mockEnsureDepot,
    mockApprove,
    mockDeposit,
    mockClaim,
    contractsState,
    hookState: { value: base(), base },
  }
})

vi.mock('@/hooks/useBribes4626', () => ({
  useBribes4626: vi.fn(() => hookState.value),
}))

vi.mock('@/config/contracts', () => ({
  CONTRACTS: {
    get bribesFactory4626() {
      return contractsState.bribesFactory4626
    },
    get ve4626GaugeVoting() {
      return contractsState.ve4626GaugeVoting
    },
  },
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

import { BribeDepot4626Panel } from './BribeDepot4626Panel'

describe('BribeDepot4626Panel', () => {
  beforeEach(() => {
    mockEnsureDepot.mockClear()
    mockApprove.mockClear()
    mockDeposit.mockClear()
    mockClaim.mockClear()
    hookState.value = hookState.base()
    contractsState.bribesFactory4626 = '0x4444444444444444444444444444444444444444'
    contractsState.ve4626GaugeVoting = '0x5555555555555555555555555555555555555555'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders marketplace UI when contracts configured', () => {
    render(
      <BribeDepot4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    expect(screen.getByText('Bribe marketplace')).toBeTruthy()
    expect(screen.getAllByText(/Current epoch/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Deposit bribe/i).length).toBeGreaterThan(0)
  })

  it('shows Coming Soon when factory or voting unset', () => {
    contractsState.bribesFactory4626 = undefined
    contractsState.ve4626GaugeVoting = undefined
    render(<BribeDepot4626Panel vaults={[{ address: VAULT, name: 'Test Vault' }]} />)
    expect(screen.getByText('Coming Soon')).toBeTruthy()
    expect(screen.getByText(/multi-token bribes/i)).toBeTruthy()
  })

  it('prompts approve when allowance is below amount', () => {
    render(
      <BribeDepot4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1' } })
    expect(screen.getByRole('button', { name: /Approve token/i })).toBeTruthy()
  })

  it('claim tab shows preview and claim button', () => {
    render(
      <BribeDepot4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Claim$/i }))
    expect(screen.getByText(/Your claim/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Claim bribe/i })).toBeTruthy()
  })

  it('shows success toast on confirmed tx and auto-dismisses', () => {
    vi.useFakeTimers()
    hookState.value = {
      ...hookState.base(),
      txSuccess: true,
      pendingTxHash: '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabca',
    }
    render(
      <BribeDepot4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    expect(screen.getByRole('status').textContent).toMatch(/Transaction confirmed/i)
    act(() => {
      vi.advanceTimersByTime(4_000)
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
