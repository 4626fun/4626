// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { WaitlistGroupChatPanel } from './WaitlistGroupChatPanel'

vi.mock('@/lib/xmtp/provider', () => ({
  XmtpChatProvider: ({ children }: { children: React.ReactNode }) => children,
  useXmtp: () => ({
    status: 'idle',
    connect: vi.fn(),
    conversations: [],
    error: null,
    localStateResetRequired: false,
    resetLocalState: vi.fn(),
    resetInstallations: vi.fn(),
    installationLimitInboxId: null,
  }),
}))

vi.mock('@/wallet/accountContext', () => ({
  AccountContextProvider: ({ children }: { children: React.ReactNode }) => children,
  useAccountContext: () => ({
    signerAddress: '0x1234567890123456789012345678901234567890',
    loading: false,
  }),
}))

vi.mock('@/components/chat/ChatWindow', () => ({
  ChatWindow: () => <div data-testid="chat-window">chat</div>,
}))

vi.mock('./useWaitlistChatJoin', () => ({
  useWaitlistChatJoin: () => 'awaiting_messaging',
  waitlistChatStatusMessage: (status: string) => status,
  waitlistChatBlockedMessage: () => 'Enable 4626 signing to join waitlist chat.',
}))

vi.mock('./useWaitlistXmtpStatus', () => ({
  useWaitlistXmtpStatus: () => ({
    data: {
      configured: true,
      chatReady: true,
      canJoin: true,
      groupId: 'group-1',
      groupName: 'Waitlist chat',
      executionTrack: 'legacy-owner-install',
      xmtpMemberAddress: '0x1234567890123456789012345678901234567890',
    },
    isLoading: false,
  }),
}))

function renderPanel(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('WaitlistGroupChatPanel', () => {
  it('renders nothing before setup is complete', () => {
    const { container } = renderPanel(
      <WaitlistGroupChatPanel setupComplete={false} signingReady={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('prompts to connect messaging before join can run', () => {
    renderPanel(<WaitlistGroupChatPanel setupComplete signingReady />)
    expect(screen.getByRole('region', { name: 'Waitlist group chat' })).toBeTruthy()
    expect(screen.getByText(/Connect messaging on 4626.fun first/i)).toBeTruthy()
  })
})
