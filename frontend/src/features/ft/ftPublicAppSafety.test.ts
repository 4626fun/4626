import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type Provider = {
  request: (args: {
    method: string
    params?: unknown[]
  }) => Promise<unknown>
}

type SellRow = {
  subject: string
  sellable: bigint
}

type FtTestHooks = {
  sendOneSell: (provider: Provider, row: SellRow, from: string) => Promise<string>
  sellSequential: (
    provider: Provider,
    rows: SellRow[],
    lines: string[],
    from: string,
  ) => Promise<{ ok: number; fail: number }>
  sellAtomicBatches: (
    provider: Provider,
    rows: SellRow[],
    lines: string[],
    from: string,
  ) => Promise<{ submitted: number; fail?: number; aborted: boolean }>
  setAccountFrom: (from: string) => void
}

function loadFtTestHooks(): FtTestHooks {
  const source = readFileSync(
    new URL('../../../public/ft/app.js', import.meta.url),
    'utf8',
  )
  const instrumented = source.replace(
    /\n\}\)\(\)\s*$/,
    '\n  window.__ftTestHooks = { sendOneSell, sellSequential, sellAtomicBatches, setAccountFrom: (value) => { accountFrom = value } }\n})()\n',
  )
  const elements = new Map<
    string,
    { textContent: string; dataset: Record<string, string> }
  >()
  const document = {
    readyState: 'loading',
    addEventListener: vi.fn(),
    getElementById(id: string) {
      if (!elements.has(id)) {
        elements.set(id, { textContent: '', dataset: {} })
      }
      return elements.get(id)!
    },
  }
  const window: {
    document: typeof document
    __ftTestHooks?: FtTestHooks
  } = { document }

  vm.runInNewContext(instrumented, {
    window,
    document,
    console,
    setTimeout,
  })

  if (!window.__ftTestHooks) throw new Error('Failed to load Friend.tech test hooks')
  return window.__ftTestHooks
}

const ACCOUNT_A = '0x1111111111111111111111111111111111111111'
const ACCOUNT_B = '0x2222222222222222222222222222222222222222'
const FIRST_ROW: SellRow = {
  subject: '0x3333333333333333333333333333333333333333',
  sellable: 1n,
}
const ROWS: SellRow[] = [
  FIRST_ROW,
  {
    subject: '0x4444444444444444444444444444444444444444',
    sellable: 2n,
  },
]

describe('Friend.tech public withdrawal safety', () => {
  it('does not retry a sell after a non-parameter RPC failure', async () => {
    const { sendOneSell } = loadFtTestHooks()
    const error = { code: -32603, message: 'Internal JSON-RPC error' }
    const request = vi.fn().mockRejectedValue(error)

    await expect(
      sendOneSell({ request }, FIRST_ROW, ACCOUNT_A),
    ).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps the scanned sender on every invalid-parameter retry', async () => {
    const { sendOneSell } = loadFtTestHooks()
    const request = vi
      .fn()
      .mockRejectedValue({ code: -32602, message: 'Invalid params' })

    await expect(sendOneSell({ request }, FIRST_ROW, ACCOUNT_A)).rejects.toMatchObject({
      code: -32602,
    })
    expect(request).toHaveBeenCalledTimes(3)
    for (const [{ params }] of request.mock.calls) {
      expect((params as Array<Record<string, string>>)[0]?.from).toBe(ACCOUNT_A)
    }
  })

  it('freezes the sender for the full multi-position withdrawal', async () => {
    const { sellSequential, setAccountFrom } = loadFtTestHooks()
    setAccountFrom(ACCOUNT_A)
    const sent: Array<Record<string, string>> = []
    const request = vi.fn(async ({ params }) => {
      sent.push(params[0] as Record<string, string>)
      if (sent.length === 1) setAccountFrom(ACCOUNT_B)
      return `0x${sent.length}`
    })

    await expect(sellSequential({ request }, ROWS, [], ACCOUNT_A)).resolves.toEqual({
      ok: 2,
      fail: 0,
    })
    expect(sent.map((tx) => tx.from)).toEqual([ACCOUNT_A, ACCOUNT_A])
  })

  it('does not replay an ambiguously accepted atomic batch', async () => {
    const { sellAtomicBatches } = loadFtTestHooks()
    const error = { code: -32603, message: 'Internal JSON-RPC error after submission' }
    const request = vi.fn(async ({ method }) => {
      if (method === 'wallet_sendCalls') throw error
      throw new Error(`Unexpected method: ${method}`)
    })

    await expect(
      sellAtomicBatches({ request }, ROWS, [], ACCOUNT_A),
    ).rejects.toBe(error)
    expect(request.mock.calls.map(([args]) => args.method)).toEqual(['wallet_sendCalls'])
  })

  it('falls back only after a definitive unsupported error and keeps the sender', async () => {
    const { sellAtomicBatches, setAccountFrom } = loadFtTestHooks()
    const sent: Array<Record<string, string>> = []
    const request = vi.fn(async ({ method, params }) => {
      if (method === 'wallet_sendCalls') {
        setAccountFrom(ACCOUNT_B)
        throw { code: -32601, message: 'Method not found' }
      }
      if (method === 'eth_sendTransaction') {
        const tx = (params as Array<Record<string, string>>)[0]
        if (!tx) throw new Error('Missing transaction payload')
        sent.push(tx)
        return `0x${sent.length}`
      }
      throw new Error(`Unexpected method: ${method}`)
    })

    await expect(
      sellAtomicBatches({ request }, ROWS, [], ACCOUNT_A),
    ).resolves.toMatchObject({
      submitted: 2,
      fail: 0,
      aborted: false,
    })
    expect(sent.map((tx) => tx.from)).toEqual([ACCOUNT_A, ACCOUNT_A])
  })

  it('waits for atomic confirmation before counting the batch', async () => {
    const { sellAtomicBatches } = loadFtTestHooks()
    const request = vi.fn(async ({ method }) => {
      if (method === 'wallet_sendCalls') return { id: 'bundle-1' }
      if (method === 'wallet_getCallsStatus') return { status: 200 }
      throw new Error(`Unexpected method: ${method}`)
    })

    await expect(
      sellAtomicBatches({ request }, ROWS, [], ACCOUNT_A),
    ).resolves.toEqual({
      submitted: 2,
      fail: 0,
      aborted: false,
    })
    expect(request.mock.calls.map(([args]) => args.method)).toEqual([
      'wallet_sendCalls',
      'wallet_getCallsStatus',
    ])
  })

  it('does not replay a terminally failed atomic batch', async () => {
    const { sellAtomicBatches } = loadFtTestHooks()
    const request = vi.fn(async ({ method }) => {
      if (method === 'wallet_sendCalls') return { callBundleId: 'bundle-1' }
      if (method === 'wallet_getCallsStatus') return { status: 500 }
      throw new Error(`Unexpected method: ${method}`)
    })

    await expect(
      sellAtomicBatches({ request }, ROWS, [], ACCOUNT_A),
    ).rejects.toThrow('wallet_sendCalls falló con estado 500')
    expect(request.mock.calls.map(([args]) => args.method)).toEqual([
      'wallet_sendCalls',
      'wallet_getCallsStatus',
    ])
  })
})
