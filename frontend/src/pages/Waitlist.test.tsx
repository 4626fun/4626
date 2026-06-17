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

vi.mock('@/features/waitlist/WaitlistFlow', () => ({
  WaitlistFlow: () => {
    throw new Error('WaitlistFlow should not mount when Privy is disabled')
  },
}))

import { Waitlist } from './Waitlist'

describe('Waitlist', () => {
  beforeEach(() => {
    mockPrivyClientStatus = 'disabled'
  })

  it('does not mount Privy hook consumers when the Privy client is disabled', () => {
    render(<Waitlist />)

    expect(screen.getByText('Waitlist unavailable')).toBeTruthy()
    expect(screen.getByText('Email sign-in is not configured.')).toBeTruthy()
  })
})
