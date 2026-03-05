import { beforeEach, describe, expect, it, vi } from 'vitest'

const { executeBankrSkillMock } = vi.hoisted(() => ({
  executeBankrSkillMock: vi.fn(),
}))

vi.mock('./agentSkills.js', () => ({
  executeBankrSkill: executeBankrSkillMock,
}))

import { handleBankrCommand } from './commands.ts'

const BASE_PARAMS = {
  groupId: 'group-1',
  senderWallet: '0x1111111111111111111111111111111111111111' as const,
  role: 'MEMBER' as const,
  canonicalOwnerAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
}

describe('handleBankrCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns help output', async () => {
    const result = await handleBankrCommand({
      ...BASE_PARAMS,
      text: '/bankr help',
    })
    expect(result.ok).toBe(true)
    expect(result.response).toContain('/bankr status')
  })

  it('parses read prompt command', async () => {
    executeBankrSkillMock.mockResolvedValueOnce({
      intent: 'read',
      response: 'ETH is $3,000',
    })

    const result = await handleBankrCommand({
      ...BASE_PARAMS,
      text: '/bankr ask what is ETH price',
    })

    expect(result.ok).toBe(true)
    expect(executeBankrSkillMock).toHaveBeenCalledWith(
      'bankr_prompt',
      { prompt: 'what is ETH price', intent: 'read' },
      expect.objectContaining({ role: 'MEMBER' }),
    )
  })

  it('parses write command and forwards confirm flag', async () => {
    executeBankrSkillMock.mockResolvedValueOnce({
      status: 'completed',
      jobId: 'job_1',
      response: 'submitted',
      walletProbe: { walletMatch: true },
    })

    const result = await handleBankrCommand({
      ...BASE_PARAMS,
      role: 'OWNER',
      text: '/bankr exec swap 1 eth to usdc --confirm',
    })

    expect(result.ok).toBe(true)
    expect(executeBankrSkillMock).toHaveBeenCalledWith(
      'bankr_prompt',
      {
        prompt: 'swap 1 eth to usdc',
        intent: 'write',
        confirm: true,
      },
      expect.objectContaining({ role: 'OWNER' }),
    )
  })

  it('returns usage error when exec instruction is missing', async () => {
    const result = await handleBankrCommand({
      ...BASE_PARAMS,
      role: 'OWNER',
      text: '/bankr exec --confirm',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Usage')
    expect(executeBankrSkillMock).not.toHaveBeenCalled()
  })

  it('returns unknown command message for unsupported subcommand', async () => {
    const result = await handleBankrCommand({
      ...BASE_PARAMS,
      text: '/bankr something',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Unknown /bankr command')
  })
})
