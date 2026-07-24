import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

import { forwardSolanaShareOftToHub } from '../utils/solanaOftForward.js'

describe('solana OFT forward adapter', () => {
  const envKeys = [
    'SOLANA_OFT_FORWARD_ENABLED',
    'SOLANA_OFT_STORE',
    'SOLANA_OFT_FORWARD_HELPER',
    'SOLANA_OFT_FORWARD_TO_BYTES32',
    'SOLANA_OFT_FORWARD_DST_EID',
  ] as const
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  afterEach(() => {
    vi.clearAllMocks()
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('fails closed when forward is disabled', async () => {
    delete process.env.SOLANA_OFT_FORWARD_ENABLED
    await expect(
      forwardSolanaShareOftToHub({
        mint: PublicKey.default,
        amountLd: 1n,
        toBytes32: `0x${'11'.repeat(32)}`,
      }),
    ).rejects.toThrow('solana_oft_forward_disabled')
  })

  it('fails closed when helper script is missing', async () => {
    process.env.SOLANA_OFT_FORWARD_ENABLED = '1'
    process.env.SOLANA_OFT_STORE = '11111111111111111111111111111111'
    delete process.env.SOLANA_OFT_FORWARD_HELPER
    await expect(
      forwardSolanaShareOftToHub({
        mint: PublicKey.default,
        amountLd: 1n,
        toBytes32: `0x${'11'.repeat(32)}`,
      }),
    ).rejects.toThrow('solana_oft_forward_helper_required')
  })

  it('runs the helper and parses stdout JSON', async () => {
    process.env.SOLANA_OFT_FORWARD_ENABLED = '1'
    process.env.SOLANA_OFT_STORE = '11111111111111111111111111111111'
    process.env.SOLANA_OFT_FORWARD_HELPER = 'node helper.js'
    process.env.SOLANA_OFT_FORWARD_DST_EID = '30184'

    spawnMock.mockImplementation((_cmd: string, _args: string[], opts: { env: NodeJS.ProcessEnv }) => {
      expect(opts.env.SOLANA_OFT_FORWARD_AMOUNT_LD).toBe('99')
      let onStdoutData: ((chunk: Buffer) => void) | undefined
      let onClose: ((code: number) => void) | undefined
      queueMicrotask(() => {
        onStdoutData?.(Buffer.from('{"ok":true,"signature":"sig1","amountLd":"99"}\n'))
        onClose?.(0)
      })
      return {
        stdout: {
          on: (event: string, cb: (chunk: Buffer) => void) => {
            if (event === 'data') onStdoutData = cb
          },
        },
        stderr: {
          on: () => undefined,
        },
        on: (event: string, cb: (code: number) => void) => {
          if (event === 'close') onClose = cb
        },
      }
    })

    const result = await forwardSolanaShareOftToHub({
      mint: PublicKey.default,
      amountLd: 99n,
      toBytes32: `0x${'22'.repeat(32)}`,
    })
    expect(result).toEqual({
      signature: 'sig1',
      amountLd: '99',
      mode: 'helper',
    })
  })
})
