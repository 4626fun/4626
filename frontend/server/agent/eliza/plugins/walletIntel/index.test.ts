import { describe, expect, it, vi, beforeEach } from 'vitest'

const {
  buildWalletIntelligenceMock,
  traceFundersMultiChainMock,
  getWalletPortfolioMock,
  getWalletLabelsBatchMock,
} = vi.hoisted(() => ({
  buildWalletIntelligenceMock: vi.fn(),
  traceFundersMultiChainMock: vi.fn(),
  getWalletPortfolioMock: vi.fn(),
  getWalletLabelsBatchMock: vi.fn(),
}))

vi.mock('../../../../_lib/walletIntelligence.js', () => ({
  buildWalletIntelligence: buildWalletIntelligenceMock,
}))
vi.mock('../../../../_lib/funderTrace.js', () => ({
  traceFundersMultiChain: traceFundersMultiChainMock,
}))
vi.mock('../../../../_lib/debankPortfolio.js', () => ({
  getWalletPortfolio: getWalletPortfolioMock,
}))
vi.mock('../../../../_lib/walletLabels.js', () => ({
  getWalletLabelsBatch: getWalletLabelsBatchMock,
}))

import { walletIntelPlugin } from './index.ts'

type AnyAction = {
  name?: string
  validate?: (runtime: unknown, message: any) => Promise<boolean> | boolean
  handler?: (
    runtime: unknown,
    message: any,
    state?: unknown,
    options?: Record<string, unknown>,
    callback?: (content: any) => Promise<any[]>,
  ) => Promise<void>
}

function getAction(name: string): AnyAction {
  const action = (walletIntelPlugin.actions ?? []).find((entry) => entry?.name === name) as AnyAction | undefined
  if (!action?.validate || !action?.handler) {
    throw new Error(`Missing action: ${name}`)
  }
  return action
}

async function runAction(params: {
  action: AnyAction
  text: string
  senderAddress?: string
  options?: Record<string, unknown>
}): Promise<string[]> {
  const message = {
    content: {
      text: params.text,
      metadata: params.senderAddress
        ? { senderAddress: params.senderAddress }
        : {},
    },
  }
  const valid = await params.action.validate?.({}, message)
  expect(valid).toBe(true)
  const outputs: string[] = []
  await params.action.handler?.({}, message, undefined, params.options, async (content: any) => {
    outputs.push(String(content?.text ?? ''))
    return []
  })
  return outputs
}

describe('walletIntel plugin sender defaults', () => {
  const sender = '0x1111111111111111111111111111111111111111'
  const explicit = '0x2222222222222222222222222222222222222222'

  beforeEach(() => {
    vi.clearAllMocks()
    buildWalletIntelligenceMock.mockResolvedValue({
      target: sender,
      summary: {},
      nodes: [],
      edges: [],
      sources: {},
    })
    traceFundersMultiChainMock.mockResolvedValue({
      target: sender,
      chain: [],
      requestedHops: 5,
      complete: false,
      stopReason: null,
    })
    getWalletPortfolioMock.mockResolvedValue({
      address: sender,
      totalUsdValue: 0,
      activeChains: [],
      protocols: [],
      topTokens: [],
    })
    getWalletLabelsBatchMock.mockResolvedValue({})
  })

  it('defaults /intel to sender wallet when address is omitted', async () => {
    const action = getAction('WALLET_INTELLIGENCE')
    await runAction({ action, text: '/intel', senderAddress: sender })
    expect(buildWalletIntelligenceMock).toHaveBeenCalledWith(sender)
  })

  it('defaults /funder to sender wallet when address is omitted', async () => {
    const action = getAction('WALLET_FUNDER_TRACE')
    await runAction({ action, text: '/funder', senderAddress: sender })
    expect(traceFundersMultiChainMock).toHaveBeenCalledWith(sender)
  })

  it('defaults /portfolio to sender wallet when address is omitted', async () => {
    const action = getAction('WALLET_PORTFOLIO')
    await runAction({ action, text: '/portfolio', senderAddress: sender })
    expect(getWalletPortfolioMock).toHaveBeenCalledWith(sender)
  })

  it('defaults /labels to sender wallet when address is omitted', async () => {
    const action = getAction('WALLET_ENTITY_LABELS')
    await runAction({ action, text: '/labels', senderAddress: sender })
    expect(getWalletLabelsBatchMock).toHaveBeenCalledWith([sender])
  })

  it('uses explicit address over sender default', async () => {
    const action = getAction('WALLET_INTELLIGENCE')
    await runAction({
      action,
      text: `/intel ${explicit}`,
      senderAddress: sender,
    })
    expect(buildWalletIntelligenceMock).toHaveBeenCalledWith(explicit)
  })
})
