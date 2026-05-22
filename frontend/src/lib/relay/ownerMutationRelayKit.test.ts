import { describe, expect, it } from 'vitest'

import {
  buildOwnerMutationQuoteOptions,
  createOwnerMutationRelayClient,
} from '@/lib/relay/ownerMutationRelayKit'
import { REMOVE_OWNER_AT_INDEX_SELECTOR } from '@/lib/wallet/cswOwnerAbi'

describe('ownerMutationRelayKit', () => {
  it('creates a relay client with the provided source tag', () => {
    const client = createOwnerMutationRelayClient('4626-test')
    expect(client.source).toBe('4626-test')
  })

  it('builds EXACT_OUTPUT quote options with wrapped mutation calldata', () => {
    const csw = '0x1111111111111111111111111111111111111111'
    const funder = '0x2222222222222222222222222222222222222222'
    const rawMutation = `${REMOVE_OWNER_AT_INDEX_SELECTOR}${'0'.repeat(56)}` as `0x${string}`

    const quote = buildOwnerMutationQuoteOptions({
      funderAddress: funder,
      cswAddress: csw,
      mutationCalldata: rawMutation,
      depositAmountWei: '123456789',
    })

    expect(quote.user).toBe(funder)
    expect(quote.recipient).toBe(csw)
    expect(quote.tradeType).toBe('EXACT_OUTPUT')
    expect(quote.amount).toBe('123456789')
    expect(quote.subsidizeFees).toBe(true)
    expect(quote.txs?.[0]?.to).toBe(csw)
    expect(quote.txs?.[0]?.data?.startsWith('0x')).toBe(true)
    expect(quote.txs?.[0]?.data).not.toBe(rawMutation)
  })
})
