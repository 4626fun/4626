import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatProtocolAgentXmtpDmLink, sendProtocolAgentXmtpDm } from './protocolXmtpAlertSender.js'

const PROTOCOL_CSW_ADDRESS = '0x793ca28123cba3ca3c20b9c6c67f37510c89c145'
const RECIPIENT = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'

const startMock = vi.fn(async () => undefined)
const stopMock = vi.fn(async () => undefined)
const canMessageMock = vi.fn(async (): Promise<boolean | null> => true)
const createDmMock = vi.fn(async () => 'convo-1')
const sendToConversationMock = vi.fn(async () => undefined)

vi.mock('../../agents/eliza/plugins/xmtp/service.js', () => ({
  XmtpService: vi.fn().mockImplementation(function XmtpServiceMock() {
    return {
      start: startMock,
      stop: stopMock,
      canMessage: canMessageMock,
      createDm: createDmMock,
      sendToConversation: sendToConversationMock,
    }
  }),
}))

describe('formatProtocolAgentXmtpDmLink', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('points at the in-app 4626 chat deep link, not a third-party XMTP client', () => {
    const link = formatProtocolAgentXmtpDmLink()
    expect(link.startsWith('https://app.4626.fun/')).toBe(true)
    expect(link).not.toContain('xmtp.chat')

    const url = new URL(link)
    expect(url.searchParams.get('chatAction')).toBe('help')
    expect(url.searchParams.get('chatPeer')).toBe(PROTOCOL_CSW_ADDRESS)
  })
})

describe('sendProtocolAgentXmtpDm', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns not_configured when the protocol CSW Privy wallet id is missing', async () => {
    const result = await sendProtocolAgentXmtpDm({ recipientAddress: RECIPIENT, text: 'hi' })
    expect(result).toEqual({ ok: false, reason: 'not_configured' })
    expect(startMock).not.toHaveBeenCalled()
  })

  it('returns invalid_recipient for a malformed address', async () => {
    vi.stubEnv('PROTOCOL_CSW_PRIVY_WALLET_ID', 'wallet-123')
    const result = await sendProtocolAgentXmtpDm({ recipientAddress: 'not-an-address', text: 'hi' })
    expect(result).toEqual({ ok: false, reason: 'invalid_recipient' })
    expect(startMock).not.toHaveBeenCalled()
  })

  it('returns not_registered (without attempting createDm) when the recipient has no XMTP identity yet', async () => {
    vi.stubEnv('PROTOCOL_CSW_PRIVY_WALLET_ID', 'wallet-123')
    canMessageMock.mockResolvedValueOnce(false)
    const result = await sendProtocolAgentXmtpDm({ recipientAddress: RECIPIENT, text: 'hi' })
    expect(result).toEqual({ ok: false, reason: 'not_registered' })
    expect(createDmMock).not.toHaveBeenCalled()
  })

  it('sends successfully when the recipient is reachable', async () => {
    vi.stubEnv('PROTOCOL_CSW_PRIVY_WALLET_ID', 'wallet-123')
    canMessageMock.mockResolvedValueOnce(true)
    const result = await sendProtocolAgentXmtpDm({ recipientAddress: RECIPIENT, text: 'hi' })
    expect(result).toEqual({ ok: true, reason: null })
    expect(createDmMock).toHaveBeenCalledWith(RECIPIENT)
    expect(sendToConversationMock).toHaveBeenCalledWith('convo-1', 'hi')
  })

  it('does not block the send attempt on an ambiguous (null) canMessage result, but classifies a later failure as send_failed', async () => {
    vi.stubEnv('PROTOCOL_CSW_PRIVY_WALLET_ID', 'wallet-123')
    canMessageMock.mockResolvedValueOnce(null)
    createDmMock.mockRejectedValueOnce(new Error('boom'))
    const result = await sendProtocolAgentXmtpDm({ recipientAddress: RECIPIENT, text: 'hi' })
    expect(result).toEqual({ ok: false, reason: 'send_failed' })
    expect(createDmMock).toHaveBeenCalledWith(RECIPIENT)
  })
})
