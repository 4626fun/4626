// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'

const {
  VAULT,
  TOKEN,
  STREAM,
  mockEnsure,
  mockApprove,
  mockFund,
  mockClaim,
  contractsState,
  hookState,
} = vi.hoisted(() => {
  const VAULT = '0x1111111111111111111111111111111111111111'
  const TOKEN = '0x2222222222222222222222222222222222222222'
  const STREAM = '0x6666666666666666666666666666666666666666'
  const mockEnsure = vi.fn()
  const mockApprove = vi.fn()
  const mockFund = vi.fn()
  const mockClaim = vi.fn()
  const maxAllowance = 2n ** 256n - 1n
  const contractsState = {
    rewardStreamFactory4626: '0x7777777777777777777777777777777777777777' as `0x${string}` | undefined,
    ve4626GaugeVoting: '0x5555555555555555555555555555555555555555' as `0x${string}` | undefined,
  }
  // Field names must match useRewardStream4626 return (epochBag, not epochFund).
  const base = () => ({
    stream: STREAM,
    currentEpoch: 5 as number | undefined,
    claimEpoch: 4 as number | undefined,
    canReceiveStreams: true,
    isRewardToken: true,
    currentEpochBag: 2_000_000_000_000_000_000n,
    epochBag: 1_000_000_000_000_000_000n,
    hasClaimed: false,
    claimPreview: 400_000_000_000_000_000n,
    tokenDecimals: 18,
    tokenSymbol: 'PARTNER' as string | undefined,
    tokenAllowance: maxAllowance,
    tokenBalance: 50_000_000_000_000_000_000n,
    ensureStream: mockEnsure,
    approveToken: mockApprove,
    fundStream: mockFund,
    claimStream: mockClaim,
    isPending: false,
    txSuccess: false,
    pendingTxHash: undefined as `0x${string}` | undefined,
  })
  return {
    VAULT,
    TOKEN,
    STREAM,
    mockEnsure,
    mockApprove,
    mockFund,
    mockClaim,
    contractsState,
    hookState: { value: base(), base },
  }
})

vi.mock('@/hooks/useRewardStream4626', () => ({
  useRewardStream4626: () => hookState.value,
}))

vi.mock('@/config/contracts', () => ({
  CONTRACTS: {
    get rewardStreamFactory4626() {
      return contractsState.rewardStreamFactory4626
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

import { RewardStream4626Panel } from './RewardStream4626Panel'

describe('RewardStream4626Panel', () => {
  beforeEach(() => {
    mockEnsure.mockClear()
    mockApprove.mockClear()
    mockFund.mockClear()
    mockClaim.mockClear()
    hookState.value = hookState.base()
    contractsState.rewardStreamFactory4626 = '0x7777777777777777777777777777777777777777'
    contractsState.ve4626GaugeVoting = '0x5555555555555555555555555555555555555555'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders partner streams UI when contracts configured', () => {
    render(
      <RewardStream4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    expect(screen.getByText('Partner reward streams')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Claim$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Fund campaign/i })).toBeTruthy()
  })

  it('shows Coming Soon when factory unset', () => {
    contractsState.rewardStreamFactory4626 = undefined
    render(<RewardStream4626Panel vaults={[{ address: VAULT, name: 'Test Vault' }]} />)
    expect(screen.getByText('Coming Soon')).toBeTruthy()
    expect(screen.getByText(/partner campaigns/i)).toBeTruthy()
  })

  it('default claim tab shows claim button with preview', () => {
    render(
      <RewardStream4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    expect(screen.getByText(/Your claim/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Claim rewards/i })).toBeTruthy()
  })

  it('fund tab shows fund button when allowlisted and approved', () => {
    render(
      <RewardStream4626Panel
        vaults={[{ address: VAULT, name: 'Test Vault' }]}
        defaultToken={TOKEN}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Fund campaign/i }))
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1' } })
    expect(screen.getByRole('button', { name: /Fund stream/i })).toBeTruthy()
  })

  it('shows success toast on confirmed tx and auto-dismisses', () => {
    vi.useFakeTimers()
    hookState.value = {
      ...hookState.base(),
      txSuccess: true,
      pendingTxHash: '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabca',
    }
    render(
      <RewardStream4626Panel
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
