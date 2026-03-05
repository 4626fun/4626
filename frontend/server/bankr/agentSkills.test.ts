import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bankrGetMeMock,
  bankrGetBalancesMock,
  bankrPromptMock,
  probeMock,
} = vi.hoisted(() => ({
  bankrGetMeMock: vi.fn(),
  bankrGetBalancesMock: vi.fn(),
  bankrPromptMock: vi.fn(),
  probeMock: vi.fn(),
}))

vi.mock('./client.js', () => ({
  bankrGetMe: bankrGetMeMock,
  bankrGetBalances: bankrGetBalancesMock,
  bankrPrompt: bankrPromptMock,
}))

vi.mock('./probe.js', () => ({
  probeBankrCanonicalWalletMatch: probeMock,
}))

import { executeBankrSkill } from './agentSkills.ts'

describe('executeBankrSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bankrGetMeMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        success: true,
        wallets: [{ chain: 'evm', address: '0xab6d5c10b03300326cd7fab7267ae192842967b5' }],
      },
    })
    bankrGetBalancesMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, balances: [] },
    })
    bankrPromptMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        jobId: 'job_1',
        threadId: 'thr_1',
        status: 'completed',
        response: 'ok',
        raw: { status: 'completed' },
      },
    })
    probeMock.mockResolvedValue({
      configured: true,
      walletMatch: true,
      reason: 'wallet_match',
      expectedCanonical: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      bankrEvmWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      bankrEvmWallets: ['0xab6d5c10b03300326cd7fab7267ae192842967b5'],
      bankrError: null,
    })
  })

  it('returns Bankr account info for bankr_me', async () => {
    const result = await executeBankrSkill('bankr_me', {}, {})
    expect(bankrGetMeMock).toHaveBeenCalledTimes(1)
    expect((result as any).success).toBe(true)
  })

  it('blocks write-intent prompts for MEMBER role', async () => {
    await expect(
      executeBankrSkill(
        'bankr_prompt',
        { prompt: 'swap 1 eth to usdc', intent: 'write', confirm: true },
        { role: 'MEMBER' },
      ),
    ).rejects.toThrow(/ADMIN or OWNER role required/i)
    expect(probeMock).not.toHaveBeenCalled()
    expect(bankrPromptMock).not.toHaveBeenCalled()
  })

  it('blocks write-intent prompts without explicit confirm=true', async () => {
    await expect(
      executeBankrSkill(
        'bankr_prompt',
        { prompt: 'swap 1 eth to usdc', intent: 'write', confirm: false },
        { role: 'ADMIN' },
      ),
    ).rejects.toThrow(/confirm=true is required/i)
    expect(probeMock).not.toHaveBeenCalled()
    expect(bankrPromptMock).not.toHaveBeenCalled()
  })

  it('blocks write-intent prompts when canonical wallet does not match', async () => {
    probeMock.mockResolvedValueOnce({
      configured: true,
      walletMatch: false,
      reason: 'wallet_mismatch',
      expectedCanonical: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      bankrEvmWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      bankrEvmWallets: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      bankrError: null,
    })

    await expect(
      executeBankrSkill(
        'bankr_prompt',
        { prompt: 'swap 1 eth to usdc', intent: 'write', confirm: true },
        { role: 'OWNER' },
      ),
    ).rejects.toThrow(/wallet_mismatch/i)
    expect(bankrPromptMock).not.toHaveBeenCalled()
  })

  it('allows write-intent prompts after all guards pass', async () => {
    const result = await executeBankrSkill(
      'bankr_prompt',
      { prompt: 'swap 1 eth to usdc', intent: 'write', confirm: true },
      { role: 'OWNER', signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd' },
    )

    expect(probeMock).toHaveBeenCalledTimes(1)
    expect(bankrPromptMock).toHaveBeenCalledTimes(1)
    expect((result as any).intent).toBe('write')
    expect((result as any).walletProbe?.walletMatch).toBe(true)
  })
})
