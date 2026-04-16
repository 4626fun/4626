import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import { handleSendCommand } from '../sendCommand.js'

const checkDurableRateLimitMock = vi.fn()
const isDbConfiguredMock = vi.fn()
const getDbMock = vi.fn()
const walletRpcMock = vi.fn()
const attestationGateMock = vi.fn()

vi.mock('../../_lib/infra/durableRateLimit.js', () => ({
  checkDurableRateLimit: (...args: unknown[]) => checkDurableRateLimitMock(...args),
}))

vi.mock('../../_lib/db/postgres.js', () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getDb: () => getDbMock(),
}))

vi.mock('../../_lib/wallet/privyWalletApi.js', () => ({
  walletRpc: (...args: unknown[]) => walletRpcMock(...args),
}))

vi.mock('../../_lib/agent/teeAttestationGate.js', () => ({
  assertTeeAttestationOrThrow: (...args: unknown[]) => attestationGateMock(...args),
}))

vi.mock('../../_lib/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('handleSendCommand durable daily limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true })
    isDbConfiguredMock.mockReturnValue(false)
    getDbMock.mockResolvedValue(null)
    walletRpcMock.mockResolvedValue({ data: { hash: '0xabc' } })
    attestationGateMock.mockResolvedValue(undefined)
  })

  it('fails closed when durable daily-limit ledger is unavailable', async () => {
    const result = await handleSendCommand({
      groupId: 'group-1',
      senderWallet: getAddress('0x1234567890123456789012345678901234567890'),
      text: '/send 10 USDC to 0x1111111111111111111111111111111111111111',
      role: 'ADMIN',
      vault: {
        vaultAddress: getAddress('0x2222222222222222222222222222222222222222'),
        creatorCoinAddress: getAddress('0x3333333333333333333333333333333333333333'),
      } as any,
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('Limit exceeded')
    expect(result.response).toContain('Durable daily limits are temporarily unavailable')
    expect(walletRpcMock).not.toHaveBeenCalled()
  })
})
