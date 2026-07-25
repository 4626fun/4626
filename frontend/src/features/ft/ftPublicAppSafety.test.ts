import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type Provider = {
  request: (args: {
    method: string
    params: Array<Record<string, string>>
  }) => Promise<string>
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
  ) => Promise<{ ok: number; fail: number }>
  setAccountFrom: (from: string) => void
}

function loadFtTestHooks(): FtTestHooks {
  const source = readFileSync(
    new URL('../../../public/ft/app.js', import.meta.url),
    'utf8',
  )
  const instrumented = source.replace(
    /\n\}\)\(\)\s*$/,
    '\n  window.__ftTestHooks = { sendOneSell, sellSequential, setAccountFrom: (value) => { accountFrom = value } }\n})()\n',
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
      expect(params[0].from).toBe(ACCOUNT_A)
    }
  })

  it('freezes the sender for the full multi-position withdrawal', async () => {
    const { sellSequential, setAccountFrom } = loadFtTestHooks()
    setAccountFrom(ACCOUNT_A)
    const sent: Array<Record<string, string>> = []
    const request = vi.fn(async ({ params }) => {
      sent.push(params[0])
      if (sent.length === 1) setAccountFrom(ACCOUNT_B)
      return `0x${sent.length}`
    })

    await expect(sellSequential({ request }, ROWS, [])).resolves.toEqual({
      ok: 2,
      fail: 0,
    })
    expect(sent.map((tx) => tx.from)).toEqual([ACCOUNT_A, ACCOUNT_A])
  })
})
