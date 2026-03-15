import { describe, expect, it } from 'vitest'

import { deriveLinkedMethodsFromPrivyUser } from '../../server/_lib/accountsIdentity.js'

describe('deriveLinkedMethodsFromPrivyUser', () => {
  it('derives telegram linked methods from the current Privy telegram type only', () => {
    const linked = deriveLinkedMethodsFromPrivyUser({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'telegram', username: 'akita' }],
    } as any)

    expect(linked.telegram).toEqual(['akita'])
  })
})
