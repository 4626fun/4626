import { describe, expect, it } from 'vitest'

import { deriveLinkedMethodsFromPrivyUser } from '../../server/_lib/accountsIdentity.js'

describe('deriveLinkedMethodsFromPrivyUser', () => {
  it('derives telegram linked methods from Privy linked accounts', () => {
    const linked = deriveLinkedMethodsFromPrivyUser({
      id: 'did:privy:test-user',
      linkedAccounts: [
        { type: 'telegram', username: 'akita' },
        { type: 'telegram_oauth', address: 'akita_telegram' },
      ],
    } as any)

    expect(linked.telegram).toEqual(['akita', 'akita_telegram'])
  })
})
