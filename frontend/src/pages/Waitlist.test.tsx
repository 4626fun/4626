// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockPrivyClientStatus: 'disabled' | 'loading' | 'ready' = 'disabled'

vi.mock('@/lib/privy/client', () => ({
  PrivyClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePrivyClientStatus: () => mockPrivyClientStatus,
}))

vi.mock('@/web3/AppQueryProvider', () => ({
  AppQueryProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/layout/AppLoadingOverlay', () => ({
  AppLoadingRegistrar: () => null,
}))

vi.mock('@/features/waitlist/WaitlistFlow', () => ({
  WaitlistFlow: () => <div data-testid="waitlist-flow-mock">waitlist flow mounted</div>,
}))

import { Waitlist } from './Waitlist'

describe('Waitlist', () => {
  beforeEach(() => {
    mockPrivyClientStatus = 'disabled'
  })

  it('still mounts the waitlist flow when Privy client is disabled', async () => {
    render(<Waitlist />)

    expect(await screen.findByTestId('waitlist-flow-mock')).toBeTruthy()
  })
})
