import { describe, expect, it, vi } from 'vitest'

import { refreshWalletClientSession } from '@/lib/wallet/refreshWalletClientSession'

describe('refreshWalletClientSession', () => {
  it('calls refreshSession when present on the wallet client', async () => {
    const refreshSession = vi.fn(async () => true)
    await refreshWalletClientSession({ refreshSession })
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('no-ops when refreshSession is absent', async () => {
    await expect(refreshWalletClientSession({})).resolves.toBeUndefined()
  })
})
