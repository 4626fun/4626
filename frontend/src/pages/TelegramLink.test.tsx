// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  navigateMock,
  ensureSessionMock,
  setupUiMock,
  apiFetchMock,
  sendCodeMock,
  loginWithCodeMock,
  linkTelegramMock,
  privyState,
  linkAccountCallbacksRef,
  trackTelegramLinkTelemetryEventMock,
  createTelegramLinkFlowIdMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  ensureSessionMock: vi.fn(),
  setupUiMock: vi.fn(() => vi.fn()),
  apiFetchMock: vi.fn(),
  sendCodeMock: vi.fn(),
  loginWithCodeMock: vi.fn(),
  linkTelegramMock: vi.fn(),
  privyState: {
    ready: true,
    authenticated: true,
    user: {
      id: 'did:privy:user-1',
      linkedAccounts: [],
    } as any,
    getAccessToken: vi.fn(async () => 'privy-access-token'),
  },
  linkAccountCallbacksRef: { current: null as any },
  trackTelegramLinkTelemetryEventMock: vi.fn(),
  createTelegramLinkFlowIdMock: vi.fn(() => 'flow-telemetry-1'),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/lib/telegramWebApp', () => ({
  ensureTelegramMiniAppSession: ensureSessionMock,
  setupTelegramMiniAppUi: setupUiMock,
}))

vi.mock('@/lib/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('@/lib/telegramLinkTelemetry', () => ({
  trackTelegramLinkTelemetryEvent: trackTelegramLinkTelemetryEventMock,
  createTelegramLinkFlowId: createTelegramLinkFlowIdMock,
}))

vi.mock('@privy-io/react-auth', () => ({
  useLoginWithEmail: () => ({
    sendCode: sendCodeMock,
    loginWithCode: loginWithCodeMock,
    state: 'idle',
  }),
  usePrivy: () => privyState,
  useLinkAccount: (callbacks?: any) => {
    linkAccountCallbacksRef.current = callbacks ?? null
    return {
      linkTelegram: (...args: any[]) => linkTelegramMock(...args),
    }
  },
}))

import { TelegramLink } from './TelegramLink'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderFlow(initialEntry = '/telegram/link?tgEntry=link&tgLinkToken=link-token-123&tgChatId=-100123') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TelegramLink />
    </MemoryRouter>,
  )
}

function mockVerifiedSession() {
  ensureSessionMock.mockResolvedValue({
    ok: true,
    session: {
      initData: 'auth_date=1710000000&hash=abc',
      sessionToken: 'mini-session-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      telegramUserId: '42',
      telegramUsername: 'akita',
      chatId: '-100123',
      chatType: 'group',
      chatInstance: 'instance-1',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifiedSession()
  privyState.ready = true
  privyState.authenticated = true
  privyState.user = { id: 'did:privy:user-1', linkedAccounts: [] }
  privyState.getAccessToken = vi.fn(async () => 'privy-access-token')
  sendCodeMock.mockResolvedValue(undefined)
  loginWithCodeMock.mockResolvedValue(undefined)
  linkTelegramMock.mockImplementation(() => {
    linkAccountCallbacksRef.current?.onSuccess?.({
      linkMethod: 'telegram',
      user: privyState.user,
      linkedAccount: {
        type: 'telegram',
        telegramUserId: '42',
        username: 'akita',
      },
    })
  })
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path === '/api/accounts/me') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            privyUserId: 'did:privy:user-1',
            email: 'user@example.com',
            emailVerified: true,
            appAccessStatus: 'approved',
            linkedMethods: { email: ['user@example.com'] },
            accountSignals: {
              linked: true,
              canonicalCswAddress: null,
              creatorCoin: null,
              zoraHandle: null,
              lastResolvedAt: '2026-03-23T00:00:00.000Z',
            },
            score: {
              points: 15,
              tier: 1,
            },
          },
        }),
      } as Response
    }
    if (path === '/api/telegram/link/complete') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            link: {
              telegramUserId: '42',
              telegramUsername: 'akita',
              privyUserId: 'did:privy:user-1',
              profileId: 11,
              linkStatus: 'pending_wallet_setup',
              canonicalCswAddress: null,
              ownerVerified: false,
            },
            account: {
              privyUserId: 'did:privy:user-1',
              email: 'user@example.com',
              emailVerified: true,
              appAccessStatus: 'approved',
              linkedMethods: { email: ['user@example.com'], telegram: ['42'] },
              accountSignals: {
                linked: true,
                canonicalCswAddress: null,
                creatorCoin: null,
                zoraHandle: null,
                lastResolvedAt: '2026-03-23T00:00:00.000Z',
              },
              score: {
                points: 15,
                tier: 1,
              },
            },
          },
        }),
      } as Response
    }
    throw new Error(`Unexpected apiFetch path: ${path}`)
  })
})

describe('TelegramLink UI flow', () => {
  it('keeps collect_email stable while typing and only enables Send Code for a normalized valid email', async () => {
    const user = userEvent.setup()
    renderFlow()

    const input = (await screen.findByLabelText('Verified Email')) as HTMLInputElement
    const submitButton = screen.getByTestId('telegram-link-submit') as HTMLButtonElement

    expect(document.querySelector('[data-flow-state="collect_email"]')).toBeTruthy()
    expect(submitButton.disabled).toBe(true)
    expect(submitButton.getAttribute('data-disabled-reason')).toBe('empty')

    await user.type(input, 'USER@EXAMPLE')
    expect(document.querySelector('[data-flow-state="collect_email"]')).toBeTruthy()
    expect(sendCodeMock).not.toHaveBeenCalled()
    expect(submitButton.disabled).toBe(true)
    expect(submitButton.getAttribute('data-disabled-reason')).toBe('invalid_email')

    await user.type(input, '.COM ')
    expect(document.querySelector('[data-flow-state="collect_email"]')).toBeTruthy()
    expect(sendCodeMock).not.toHaveBeenCalled()
    expect(submitButton.disabled).toBe(false)
    expect(submitButton.getAttribute('data-disabled-reason')).toBe('ready')
    expect(submitButton.getAttribute('data-email-normalized')).toBe('user@example.com')
    expect(submitButton.getAttribute('data-email-valid')).toBe('true')
  })

  it('keeps the Send Code button clickable after valid email entry', async () => {
    const user = userEvent.setup()
    renderFlow()

    await user.type(await screen.findByLabelText('Verified Email'), ' USER@EXAMPLE.COM ')
    const submitButton = screen.getByTestId('telegram-link-submit') as HTMLButtonElement

    expect(submitButton.disabled).toBe(false)

    await user.click(submitButton)

    await waitFor(() => {
      expect(sendCodeMock).toHaveBeenCalledWith({ email: 'user@example.com' })
    })
    await screen.findByLabelText('Email Verification Code')
  })

  it('dispatches SUBMIT_EMAIL on click and leaves collect_email only after explicit submit', async () => {
    const user = userEvent.setup()
    const sendCodeDeferred = deferred<void>()
    sendCodeMock.mockImplementationOnce(() => sendCodeDeferred.promise)
    renderFlow()

    await user.type(await screen.findByLabelText('Verified Email'), 'user@example.com')
    expect(document.querySelector('[data-flow-state="collect_email"]')).toBeTruthy()

    await user.click(screen.getByTestId('telegram-link-submit'))

    await waitFor(() => {
      expect(document.querySelector('[data-flow-state="sending_email_code"]')).toBeTruthy()
    })
    expect(sendCodeMock).toHaveBeenCalledWith({ email: 'user@example.com' })

    await act(async () => {
      sendCodeDeferred.resolve()
      await sendCodeDeferred.promise
    })
  })

  it('renders the verify-email step without decorative overlays', async () => {
    renderFlow()

    await screen.findByLabelText('Verified Email')
    expect(screen.queryByTestId('telegram-link-decorative-overlay')).toBeNull()
    expect(screen.getByText(/Telegram:/)).toBeTruthy()
    expect(screen.getByText(/Chat:/)).toBeTruthy()
    expect(screen.getByText(/Session:/)).toBeTruthy()
  })

  it('locks document scrolling for the Telegram shell', async () => {
    const view = renderFlow()

    await screen.findByLabelText('Verified Email')

    expect(document.documentElement.classList.contains('telegram-link-html-lock')).toBe(true)
    expect(document.body.classList.contains('telegram-link-body-lock')).toBe(true)
    expect(screen.getByTestId('telegram-link-shell').className).toContain('overflow-hidden')
    expect(screen.getByTestId('telegram-link-panel').className).not.toContain('overflow-y-auto')

    view.unmount()

    expect(document.documentElement.classList.contains('telegram-link-html-lock')).toBe(false)
    expect(document.body.classList.contains('telegram-link-body-lock')).toBe(false)
  })

  it('does not reset or remount the email input while typing', async () => {
    const user = userEvent.setup()
    renderFlow()

    await screen.findByLabelText('Verified Email')
    const input = screen.getByLabelText('Verified Email') as HTMLInputElement

    await user.type(input, 'user@example.com')

    expect(screen.getByLabelText('Verified Email')).toBe(input)
    expect(input.value).toBe('user@example.com')
  })

  it('keeps recoverable OTP send failures inline on the email step', async () => {
    const user = userEvent.setup()
    sendCodeMock.mockRejectedValueOnce(new Error('Unable to send verification code.'))
    renderFlow()

    await user.type(await screen.findByLabelText('Verified Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))

    await screen.findByText('Unable to send verification code.')
    expect(screen.getByText('Verify Email')).toBeTruthy()
    expect((screen.getByLabelText('Verified Email') as HTMLInputElement).value).toBe('user@example.com')
  })

  it('keeps the OTP input usable after send and on recoverable verify failures', async () => {
    const user = userEvent.setup()
    loginWithCodeMock.mockRejectedValueOnce(new Error('Incorrect code.'))
    renderFlow()

    await user.type(await screen.findByLabelText('Verified Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))

    const codeInput = (await screen.findByLabelText('Email Verification Code')) as HTMLInputElement
    await user.type(codeInput, '123456')
    expect(codeInput.value).toBe('123456')

    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Incorrect code.')
    expect((screen.getByLabelText('Email Verification Code') as HTMLInputElement).value).toBe('123456')
  })

  it('shows wait_for_privy_sync before any success UI', async () => {
    const user = userEvent.setup()
    const accountsDeferred = deferred<Response>()
    apiFetchMock.mockImplementationOnce(async () => accountsDeferred.promise)
    renderFlow()

    await user.type(await screen.findByLabelText('Verified Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))
    await user.type(await screen.findByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Awaiting Account Sync')
    expect(screen.queryByText('Telegram Linked')).toBeNull()

    await act(async () => {
      accountsDeferred.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            privyUserId: 'did:privy:user-1',
            email: 'user@example.com',
            emailVerified: true,
            appAccessStatus: 'approved',
            linkedMethods: { email: ['user@example.com'] },
            accountSignals: {
              linked: true,
              canonicalCswAddress: null,
              creatorCoin: null,
              zoraHandle: null,
              lastResolvedAt: '2026-03-23T00:00:00.000Z',
            },
            score: { points: 15, tier: 1 },
          },
        }),
      } as Response)
      await accountsDeferred.promise
    })
    await screen.findByText('Telegram Linked')
  })

  it('does not strip query-derived link context before proof capture', async () => {
    const sessionDeferred = deferred<any>()
    ensureSessionMock.mockImplementationOnce(async () => sessionDeferred.promise)
    renderFlow()

    expect(navigateMock).not.toHaveBeenCalled()

    await act(async () => {
      sessionDeferred.resolve({
        ok: true,
        session: {
          initData: 'auth_date=1710000000&hash=abc',
          sessionToken: 'mini-session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
          telegramUserId: '42',
          telegramUsername: 'akita',
          chatId: '-100123',
          chatType: 'group',
          chatInstance: 'instance-1',
        },
      })
      await sessionDeferred.promise
    })

    await screen.findByText('Verify Email')
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/telegram/link',
        search: '',
      }),
      { replace: true },
    )
  })

  it('keeps success stable on rerender after the flow completes', async () => {
    const user = userEvent.setup()
    function Harness(props: { tick: number }) {
      return (
        <MemoryRouter initialEntries={['/telegram/link']}>
          <div data-tick={props.tick}>
            <TelegramLink />
          </div>
        </MemoryRouter>
      )
    }
    const view = render(<Harness tick={0} />)

    await user.type(await screen.findByLabelText('Verified Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))
    await user.type(await screen.findByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Telegram Linked')

    privyState.authenticated = false
    privyState.user = null

    view.rerender(<Harness tick={1} />)

    await waitFor(() => {
      expect(screen.getByText('Telegram Linked')).toBeTruthy()
    })
  })

  it('emits transition and completion telemetry for the happy path', async () => {
    const user = userEvent.setup()
    renderFlow()

    await user.type(await screen.findByLabelText('Verified Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))
    await user.type(await screen.findByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Telegram Linked')

    expect(trackTelegramLinkTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_flow_started',
        flowId: 'flow-telemetry-1',
      }),
    )
    expect(trackTelegramLinkTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_state_transition',
        fromTag: 'verify_telegram_session',
        toTag: 'collect_email',
      }),
    )
    expect(trackTelegramLinkTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_backend_completion_succeeded',
        status: 'succeeded',
      }),
    )
    expect(trackTelegramLinkTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_flow_completed',
        status: 'succeeded',
      }),
    )
  })
})
