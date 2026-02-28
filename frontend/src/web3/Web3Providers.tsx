import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TransactionProvider } from 'ethereum-identity-kit'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'

// Single QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

/**
 * Shared Web3 provider stack for app + waitlist routes.
 */
export function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <TransactionProvider>{children}</TransactionProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
