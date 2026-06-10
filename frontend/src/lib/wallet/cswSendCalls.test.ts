import { describe, expect, it } from 'vitest'

import { extractCallsStatusHashes } from '@/lib/wallet/cswSendCalls'

const BUNDLE_TX = `0x${'aa'.repeat(32)}` as const
const USER_OP_TX = `0x${'bb'.repeat(32)}` as const

describe('extractCallsStatusHashes', () => {
  it('reads bundle and userOp hashes from receipts', () => {
    expect(
      extractCallsStatusHashes({
        status: 200,
        receipts: [{ transactionHash: BUNDLE_TX, userOperationHash: USER_OP_TX }],
      }),
    ).toEqual({
      transactionHash: BUNDLE_TX,
      userOperationHash: USER_OP_TX,
    })
  })

  it('falls back to top-level userOp hash', () => {
    expect(
      extractCallsStatusHashes({
        status: 100,
        userOpHash: USER_OP_TX,
      }),
    ).toEqual({
      transactionHash: null,
      userOperationHash: USER_OP_TX,
    })
  })
})
