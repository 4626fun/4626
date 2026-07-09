// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WaitlistChatDock } from './WaitlistChatDock'

describe('WaitlistChatDock', () => {
  it('starts collapsed and expands into the fixed bottom-right chat shell', () => {
    render(
      <WaitlistChatDock
        setupComplete
        messagingReady
        connectTrack="privy-owner-install"
      />,
    )

    // Collapsed by default — avoids mounting Wagmi/Coinbase SDK on wallet-verify.
    expect(screen.getByLabelText('Open waitlist group chat')).toBeTruthy()
    expect(screen.queryByText('Loading waitlist chat…')).toBeNull()

    fireEvent.click(screen.getByLabelText('Open waitlist group chat'))

    const dock = screen.getByLabelText('Minimize waitlist group chat').closest('.fixed')
    expect(dock).toBeTruthy()
    expect(dock?.className).toContain('bottom-4')
    expect(dock?.className).toContain('right-4')
    expect(screen.getByText('Loading waitlist chat…')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Minimize waitlist group chat'))
    expect(screen.queryByText('Loading waitlist chat…')).toBeNull()
    expect(screen.getByLabelText('Open waitlist group chat')).toBeTruthy()
  })
})
