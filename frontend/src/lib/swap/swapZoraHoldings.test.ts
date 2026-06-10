import { describe, expect, it } from 'vitest'
import { getAddress, type Address } from 'viem'

import { AKITA_DEFAULTS } from '@/config/contracts.defaults'
import type { AccountTrayPortfolioBatch } from '@/lib/debank/client'

import { fetchSwapZoraHoldings, resolveSwapZoraHoldings } from './swapZoraHoldings'

const WALLET = '0xab6d5c10b03300326cd7fab7267ae192842967b5'

function portfolioBatchForWallet(): AccountTrayPortfolioBatch {
  const walletKey = getAddress(WALLET).toLowerCase()
  return {
    asOf: Date.now(),
    results: {
      [walletKey]: {
        address: getAddress(WALLET),
        totalUsdValue: 42,
        topTokens: [
          {
            id: getAddress(AKITA_DEFAULTS.token),
            chain: 'base',
            symbol: 'AKITA',
            name: 'AKITA',
            amount: 1250.5,
            price: 0.03,
            usdValue: 42,
          },
        ],
        activeChains: [],
        protocols: [],
        asOf: Date.now(),
      },
    },
    sources: { [walletKey]: 'debank' },
  }
}

describe('swapZoraHoldings', () => {
  it('maps portfolio zora creator coins into swap token rows', async () => {
    const batch = portfolioBatchForWallet()
    const fetchCoin = async (address: Address) => ({
      address: getAddress(address),
      symbol: 'AKITA',
      name: 'AKITA',
      coinType: 'CREATOR' as const,
      creatorProfile: { handle: 'akita' },
    })

    const rows = await resolveSwapZoraHoldings({
      ownerAddress: WALLET,
      batch,
      fetchCoin,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.option.symbol).toBe('AKITA')
    expect(rows[0]?.option.address).toBe(getAddress(AKITA_DEFAULTS.token))
    expect(rows[0]?.balanceFormatted).toBe('1,250.5')
  })

  it('returns empty when portfolio has no tokens', async () => {
    const walletKey = getAddress(WALLET).toLowerCase()
    const rows = await resolveSwapZoraHoldings({
      ownerAddress: WALLET,
      batch: {
        asOf: Date.now(),
        results: {
          [walletKey]: {
            address: getAddress(WALLET),
            totalUsdValue: 0,
            topTokens: [],
            activeChains: [],
            protocols: [],
            asOf: Date.now(),
          },
        },
        sources: {},
      },
    })
    expect(rows).toEqual([])
  })

  it('rejects invalid wallet addresses', async () => {
    const rows = await fetchSwapZoraHoldings('not-a-wallet')
    expect(rows).toEqual([])
  })
})
