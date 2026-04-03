// @vitest-environment happy-dom

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  navigateMock,
  ensureSessionMock,
  setupUiMock,
  telegramWebAppState,
  telegramCloseMock,
  telegramMainButtonMock,
  telegramMainButtonState,
  apiFetchMock,
  sendCodeMock,
  loginWithCodeMock,
  linkTelegramMock,
  createWalletMock,
  privyState,
  trackTelegramLinkTelemetryEventMock,
  createTelegramLinkFlowIdMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  ensureSessionMock: vi.fn(),
  setupUiMock: vi.fn(() => vi.fn()),
  telegramWebAppState: { hasMainButton: false, hasClose: false },
  telegramCloseMock: vi.fn(),
  telegramMainButtonState: { clickHandler: null as null | (() => void) },
  telegramMainButtonMock: {
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
    setText: vi.fn(),
    setParams: vi.fn(),
    onClick: vi.fn((handler: () => void) => {
      telegramMainButtonState.clickHandler = handler
    }),
    offClick: vi.fn((handler: () => void) => {
      if (telegramMainButtonState.clickHandler === handler) {
        telegramMainButtonState.clickHandler = null
      }
    }),
  },
  apiFetchMock: vi.fn(),
  sendCodeMock: vi.fn(),
  loginWithCodeMock: vi.fn(),
  linkTelegramMock: vi.fn(),
  createWalletMock: vi.fn(),
  privyState: {
    ready: true,
    authenticated: true,
    user: {
      id: 'did:privy:user-1',
      linkedAccounts: [],
    } as any,
    getAccessToken: vi.fn(async () => 'privy-access-token'),
    linkTelegram: vi.fn(),
  },
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
  loadTelegramWebApp: vi.fn(async () => ({
    ...(telegramWebAppState.hasMainButton ? { MainButton: telegramMainButtonMock } : {}),
    ...(telegramWebAppState.hasClose ? { close: telegramCloseMock } : {}),
  })),
  readTelegramWebApp: () => ({
    ...(telegramWebAppState.hasMainButton ? { MainButton: telegramMainButtonMock } : {}),
    ...(telegramWebAppState.hasClose ? { close: telegramCloseMock } : {}),
  }),
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
    sendCode: (...args: any[]) => sendCodeMock(...args),
    loginWithCode: (...args: any[]) => loginWithCodeMock(...args),
    state: 'idle',
  }),
  usePrivy: () => privyState,
  useWallets: () => ({ wallets: [] }),
  useCreateWallet: () => ({ createWallet: (...args: any[]) => createWalletMock(...args) }),
}))

import { TelegramLink } from './TelegramLink'

const CANONICAL_CSW_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

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

function expectProgressStatus(step: 'telegram' | 'email' | 'code' | 'link', status: 'complete' | 'active' | 'upcoming') {
  expect(screen.getByTestId(`telegram-link-progress-step-${step}`).getAttribute('data-status')).toBe(status)
}

beforeEach(() => {
  vi.clearAllMocks()
  telegramWebAppState.hasMainButton = false
  telegramWebAppState.hasClose = false
  telegramMainButtonState.clickHandler = null
  mockVerifiedSession()
  privyState.ready = true
  privyState.authenticated = true
  privyState.user = { id: 'did:privy:user-1', linkedAccounts: [] }
  privyState.getAccessToken = vi.fn(async () => 'privy-access-token')
  privyState.linkTelegram = linkTelegramMock as any
  sendCodeMock.mockResolvedValue(undefined)
  loginWithCodeMock.mockResolvedValue(undefined)
  linkTelegramMock.mockResolvedValue(undefined)
  createWalletMock.mockResolvedValue({ address: '0x4444444444444444444444444444444444444444' })
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path === '/api/telegram/link/ready') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            ready: true,
            account: {
              privyUserId: 'did:privy:user-1',
              email: 'user@example.com',
              emailVerified: true,
              canonicalCswAddress: CANONICAL_CSW_ADDRESS,
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
              canonicalCswAddress: CANONICAL_CSW_ADDRESS,
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
                canonicalCswAddress: CANONICAL_CSW_ADDRESS,
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

    const input = (await screen.findByLabelText('Email Address')) as HTMLInputElement
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

    const input = (await screen.findByLabelText('Email Address')) as HTMLInputElement
    await user.type(input, ' USER@EXAMPLE.COM ')
    const submitButton = screen.getByTestId('telegram-link-submit') as HTMLButtonElement

    expect(submitButton.disabled).toBe(false)
    expect(document.activeElement).toBe(input)

    await user.click(submitButton)

    await waitFor(() => {
      expect(sendCodeMock).toHaveBeenCalledWith({ email: 'user@example.com' })
    })
    await screen.findByLabelText('Email Verification Code')
  })

  it('submits from pointer activation while the email input is focused', async () => {
    renderFlow()

    const input = (await screen.findByLabelText('Email Address')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'user@example.com' } })
    input.focus()
    const submitButton = screen.getByTestId('telegram-link-submit') as HTMLButtonElement

    expect(submitButton.disabled).toBe(false)
    expect(document.activeElement).toBe(input)

    fireEvent.pointerDown(submitButton)

    await waitFor(() => {
      expect(sendCodeMock).toHaveBeenCalledWith({ email: 'user@example.com' })
    })
  })

  it('dispatches SUBMIT_EMAIL on click and leaves collect_email only after explicit submit', async () => {
    const user = userEvent.setup()
    const sendCodeDeferred = deferred<void>()
    sendCodeMock.mockImplementationOnce(() => sendCodeDeferred.promise)
    renderFlow()

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
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

  it('does not re-send or re-emit started telemetry when the component rerenders during sending_email_code', async () => {
    const user = userEvent.setup()
    const sendCodeDeferred = deferred<void>()
    sendCodeMock.mockImplementationOnce(() => sendCodeDeferred.promise)

    function Harness(props: { tick: number }) {
      return (
        <MemoryRouter initialEntries={['/telegram/link?tgEntry=link&tgLinkToken=link-token-123&tgChatId=-100123']}>
          <div data-tick={props.tick}>
            <TelegramLink />
          </div>
        </MemoryRouter>
      )
    }

    const view = render(<Harness tick={0} />)

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))

    await waitFor(() => {
      expect(document.querySelector('[data-flow-state="sending_email_code"]')).toBeTruthy()
    })
    expect(sendCodeMock).toHaveBeenCalledTimes(1)
    expect(
      trackTelegramLinkTelemetryEventMock.mock.calls.filter(
        ([payload]) => payload?.event === 'telegram_link_email_code_send_started',
      ),
    ).toHaveLength(1)

    view.rerender(<Harness tick={1} />)
    view.rerender(<Harness tick={2} />)

    expect(sendCodeMock).toHaveBeenCalledTimes(1)
    expect(
      trackTelegramLinkTelemetryEventMock.mock.calls.filter(
        ([payload]) => payload?.event === 'telegram_link_email_code_send_started',
      ),
    ).toHaveLength(1)

    await act(async () => {
      sendCodeDeferred.resolve()
      await sendCodeDeferred.promise
    })
  })

  it('exposes the same email submit path through Telegram MainButton', async () => {
    const user = userEvent.setup()
    telegramWebAppState.hasMainButton = true
    renderFlow()

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')

    expect(telegramMainButtonMock.show).toHaveBeenCalled()
    expect(telegramMainButtonMock.enable).toHaveBeenCalled()
    expect(telegramMainButtonState.clickHandler).toBeTypeOf('function')
    expect(screen.queryByTestId('telegram-link-submit')).toBeNull()

    await act(async () => {
      telegramMainButtonState.clickHandler?.()
    })

    await waitFor(() => {
      expect(sendCodeMock).toHaveBeenCalledWith({ email: 'user@example.com' })
    })
  })

  it('renders the shared Telegram Mini App shell with progress on the email step', async () => {
    renderFlow()

    await screen.findByLabelText('Email Address')
    expect(screen.getByText('Telegram Mini App')).toBeTruthy()
    expect(screen.getByText('@akita')).toBeTruthy()
    expect(screen.getByText('-100123')).toBeTruthy()
    expect(screen.getByText(/\d{2}:\d{2}\s(?:AM|PM)/)).toBeTruthy()
    expectProgressStatus('telegram', 'complete')
    expectProgressStatus('email', 'active')
    expectProgressStatus('code', 'upcoming')
    expectProgressStatus('link', 'upcoming')
  })

  it('keeps the primary call-to-action styling consistent between email and code steps', async () => {
    const user = userEvent.setup()
    renderFlow()

    await screen.findByLabelText('Email Address')
    const sendCodeButton = screen.getByRole('button', { name: 'Send Code' })
    expect(sendCodeButton.className).toContain('bg-[#0052FF]')
    expect(sendCodeButton.className).toContain('rounded-[16px]')
    expect(sendCodeButton.className).toContain('h-11')

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
    await user.click(sendCodeButton)

    const verifyCodeButton = await screen.findByRole('button', { name: 'Verify Code' })
    expect(verifyCodeButton.className).toContain('bg-[#0052FF]')
    expect(verifyCodeButton.className).toContain('rounded-[16px]')
    expect(verifyCodeButton.className).toContain('h-11')
  })

  it('locks document scrolling for the Telegram shell', async () => {
    const view = renderFlow()

    await screen.findByLabelText('Email Address')

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

    await screen.findByLabelText('Email Address')
    const input = screen.getByLabelText('Email Address') as HTMLInputElement

    await user.type(input, 'user@example.com')

    expect(screen.getByLabelText('Email Address')).toBe(input)
    expect(input.value).toBe('user@example.com')
  })

  it('keeps recoverable OTP send failures inline on the email step', async () => {
    const user = userEvent.setup()
    sendCodeMock.mockRejectedValueOnce(new Error('Unable to send verification code.'))
    renderFlow()

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))

    await screen.findByText('Unable to send verification code.')
    expect(screen.getByText('Enter Email Address')).toBeTruthy()
    expect((screen.getByLabelText('Email Address') as HTMLInputElement).value).toBe('user@example.com')
  })

  it('returns to collect_email with an inline error when sendCode hangs', async () => {
    try {
      const user = userEvent.setup()
      sendCodeMock.mockImplementationOnce(() => new Promise(() => {}))
      renderFlow()

      await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
      vi.useFakeTimers()
      fireEvent.click(screen.getByRole('button', { name: 'Send Code' }))

      expect(document.querySelector('[data-flow-state="sending_email_code"]')).toBeTruthy()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_000)
      })

      expect(screen.getByText('Verification email took too long to start. Try again.')).toBeTruthy()
      expect(document.querySelector('[data-flow-state="collect_email"]')).toBeTruthy()
      expect((screen.getByRole('button', { name: 'Send Code' }) as HTMLButtonElement).disabled).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the OTP input usable after send and on recoverable verify failures', async () => {
    const user = userEvent.setup()
    loginWithCodeMock.mockRejectedValueOnce(new Error('Incorrect code.'))
    renderFlow()

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
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

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))
    await user.type(await screen.findByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Resolving Account')
    expect(screen.queryByText('Telegram Linked')).toBeNull()

    await act(async () => {
      accountsDeferred.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            ready: true,
            account: {
              privyUserId: 'did:privy:user-1',
              email: 'user@example.com',
              emailVerified: true,
              canonicalCswAddress: CANONICAL_CSW_ADDRESS,
            },
          },
        }),
      } as Response)
      await accountsDeferred.promise
    })
    await screen.findByText('Telegram Linked')
    expect(screen.getByText('0x1234…5678')).toBeTruthy()
    expect(screen.getByText('Canonical CSW')).toBeTruthy()
    expect(screen.getByText('Connected Account')).toBeTruthy()
    expect(screen.getByText(/Wallet setup pending\./)).toBeTruthy()
    expect(screen.getAllByText('@akita')).toHaveLength(1)
    expect(screen.queryByText(/Telegram @akita is connected/i)).toBeNull()
    expect(screen.queryByText('Profile')).toBeNull()
    expect(screen.queryByText('Link Status')).toBeNull()
    expectProgressStatus('telegram', 'complete')
    expectProgressStatus('email', 'complete')
    expectProgressStatus('code', 'complete')
    expectProgressStatus('link', 'complete')
  })

  it('advances the 4-step progress indicator across the flow', async () => {
    const user = userEvent.setup()
    renderFlow()

    await screen.findByLabelText('Email Address')
    expectProgressStatus('telegram', 'complete')
    expectProgressStatus('email', 'active')
    expectProgressStatus('code', 'upcoming')
    expectProgressStatus('link', 'upcoming')

    await user.type(screen.getByLabelText('Email Address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))

    await screen.findByLabelText('Email Verification Code')
    expectProgressStatus('telegram', 'complete')
    expectProgressStatus('email', 'complete')
    expectProgressStatus('code', 'active')
    expectProgressStatus('link', 'upcoming')

    await user.type(screen.getByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Telegram Linked')
    expectProgressStatus('telegram', 'complete')
    expectProgressStatus('email', 'complete')
    expectProgressStatus('code', 'complete')
    expectProgressStatus('link', 'complete')
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

    await screen.findByText('Enter Email Address')
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

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
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

  it('offers a Telegram close action after the link succeeds when WebApp.close is available', async () => {
    const user = userEvent.setup()
    telegramWebAppState.hasClose = true
    renderFlow()

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))
    await user.type(await screen.findByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Telegram Linked')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(telegramCloseMock).toHaveBeenCalledTimes(1)
  })

  it('keeps fallback and success actions in the bottom footer', async () => {
    const user = userEvent.setup()
    telegramWebAppState.hasClose = true
    renderFlow()

    await screen.findByLabelText('Email Address')
    expect(within(screen.getByTestId('telegram-link-footer-actions')).getByRole('button', { name: 'Send Code' })).toBeTruthy()

    await user.type(screen.getByLabelText('Email Address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Code' }))

    await screen.findByLabelText('Email Verification Code')
    expect(within(screen.getByTestId('telegram-link-footer-actions')).getByRole('button', { name: 'Verify Code' })).toBeTruthy()

    await user.type(screen.getByLabelText('Email Verification Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify Code' }))

    await screen.findByText('Telegram Linked')
    expect(within(screen.getByTestId('telegram-link-footer-actions')).getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('emits transition and completion telemetry for the happy path', async () => {
    const user = userEvent.setup()
    renderFlow()

    await user.type(await screen.findByLabelText('Email Address'), 'user@example.com')
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
