import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { Web3Providers } from './web3/Web3Providers'
import { PrivyClientProvider } from '@/lib/privy/client'
import { ThemeProvider } from '@/lib/theme'
import './index.css'

const EXTENSION_ETHEREUM_ERROR_PATTERNS: RegExp[] = [
  /Cannot redefine property:\s*ethereum/i,
  /Cannot set property ethereum of #<Window> which has only a getter/i,
  /MetaMask encountered an error setting the global Ethereum provider/i,
  /Cannot access '\$a' before initialization/i,
]

function readErrorMessage(value: unknown): string {
  if (!value) return ''
  if (value instanceof Error) return value.message || ''
  return String((value as any)?.message ?? value)
}

function isKnownExtensionWalletError(message: string, source: string): boolean {
  if (!message) return false
  const hitPattern = EXTENSION_ETHEREUM_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  if (!hitPattern) return false
  const src = String(source || '').toLowerCase()
  if (!src) return true
  return (
    src.includes('chrome-extension://') ||
    src.includes('moz-extension://') ||
    src.includes('evmask.js') ||
    src.includes('requestprovider.js') ||
    src.includes('inpage.js') ||
    src.includes('formatters.js')
  )
}

if (typeof window !== 'undefined') {
  try {
    // Keep app rendering stable when multiple wallet extensions race to inject window.ethereum.
    window.addEventListener(
      'error',
      (event) => {
        if (isKnownExtensionWalletError(event.message || '', event.filename || '')) {
          event.preventDefault()
        }
      },
      true,
    )
    window.addEventListener(
      'unhandledrejection',
      (event) => {
        const message = readErrorMessage((event as PromiseRejectionEvent).reason)
        if (isKnownExtensionWalletError(message, '')) {
          event.preventDefault()
        }
      },
      true,
    )

    const params = new URLSearchParams(window.location.search)
    const debugEnabled = params.get('debug') === '1' || window.localStorage.getItem('cv:debug') === 'true'
    const disablePrivyAnalytics =
      debugEnabled ||
      params.get('privy_analytics') === '0' ||
      window.localStorage.getItem('cv:privy:analytics') === 'off' ||
      ['1', 'true', 'yes'].includes(String(import.meta.env.VITE_PRIVY_DISABLE_ANALYTICS ?? '').trim().toLowerCase())
    const needsAlchemyRewrite = true
    if ((debugEnabled || needsAlchemyRewrite) && !(window as any).__cvFetchPatched) {
      const originalFetch = window.fetch.bind(window)
      const alchemyBaseRpc = /(^|\/\/)base-mainnet\.g\.alchemy\.com/i
      // CDP RPC URLs are server-side oriented and often fail in browsers (CORS/405).
      // Always proxy them through our same-origin JSON-RPC relay.
      const coinbaseDeveloperBaseRpc = /^https:\/\/api\.developer\.coinbase\.com\/rpc\/v1\/base\//i
      const safeBaseRpc = '/api/rpc'
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (disablePrivyAnalytics && url.includes('https://auth.privy.io/api/v1/analytics_events')) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        if (alchemyBaseRpc.test(url) || coinbaseDeveloperBaseRpc.test(url)) {
          if (input instanceof Request) {
            const rewritten = new Request(safeBaseRpc, input)
            return originalFetch(rewritten, init)
          }
          return originalFetch(safeBaseRpc, init)
        }
        return originalFetch(input, init)
      }
      ;(window as any).__cvFetchPatched = true
    }
  } catch {
    // ignore
  }
}

/**
 * Minimal provider stack:
 * 
 * PrivyClientProvider (social auth only)
 *   └── BrowserRouter
 *         └── Web3Providers (wagmi + react-query)
 *               └── App
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PrivyClientProvider>
        <BrowserRouter>
          <Web3Providers>
            <App />
          </Web3Providers>
        </BrowserRouter>
      </PrivyClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
