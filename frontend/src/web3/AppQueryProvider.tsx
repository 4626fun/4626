import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function isRateLimitedError(error: unknown): boolean {
  const asAny = error as { status?: unknown; details?: unknown; shortMessage?: unknown; message?: unknown }
  const status = Number(asAny?.status ?? NaN)
  if (status === 429) return true
  const message = String(
    asAny?.details ??
      asAny?.shortMessage ??
      asAny?.message ??
      '',
  ).toLowerCase()
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  )
}

// Single QueryClient instance. Keep this module wagmi-free so email-only
// waitlist auth can use React Query without instantiating wallet connectors.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => failureCount < 1 && !isRateLimitedError(error),
    },
  },
})

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
