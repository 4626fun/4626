import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { fetchAccountTrayPortfolioBatch } from '@/lib/debank/client'
import {
  buildTrayHoldingsFromPortfolios,
  buildTrayTokenRowsFromPortfolios,
  buildTrayWalletSources,
  type TrayWalletSource,
} from '@/components/account/trayPortfolioHelpers'

type UseAccountTrayPortfolioOptions = {
  enabled?: boolean
}

export function useAccountTrayPortfolio(options: UseAccountTrayPortfolioOptions = {}) {
  const auth = useSiweAuth()
  const canonicalIdentity = useCanonicalIdentity()
  const trayWalletSources = useMemo<TrayWalletSource[]>(
    () =>
      buildTrayWalletSources({
        cswAddress: canonicalIdentity.cswAddress,
        externalEoaAddress: canonicalIdentity.externalEoaAddress,
      }),
    [canonicalIdentity.cswAddress, canonicalIdentity.externalEoaAddress],
  )
  const trayWalletKey = useMemo(
    () =>
      trayWalletSources
        .map((wallet) => wallet.address.toLowerCase())
        .sort()
        .join(','),
    [trayWalletSources],
  )
  const baseEnabled = auth.hasSession && trayWalletSources.length > 0
  const enabled = (options.enabled ?? true) && baseEnabled

  const trayPortfolioQuery = useQuery({
    queryKey: ['account-tray', 'wallet-portfolio', trayWalletKey],
    enabled,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () =>
      fetchAccountTrayPortfolioBatch({
        addresses: trayWalletSources.map((wallet) => wallet.address),
        topTokenCount: 50,
      }),
  })

  const trayPortfolioResults = useMemo(
    () => trayPortfolioQuery.data?.results ?? null,
    [trayPortfolioQuery.data],
  )

  const trayHoldings = useMemo(
    () =>
      buildTrayHoldingsFromPortfolios({
        wallets: trayWalletSources,
        portfolios: trayPortfolioResults,
      }),
    [trayPortfolioResults, trayWalletSources],
  )

  const trayTokenRows = useMemo(
    () =>
      buildTrayTokenRowsFromPortfolios({
        wallets: trayWalletSources,
        portfolios: trayPortfolioResults,
      }),
    [trayPortfolioResults, trayWalletSources],
  )

  return {
    trayWalletSources,
    trayHoldings,
    trayTokenRows,
    trayPortfolioQuery,
    isLoading: trayPortfolioQuery.isLoading,
  }
}
