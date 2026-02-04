import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { Web3Providers } from './web3/Web3Providers'
import { PrivyClientProvider } from '@/lib/privy/client'
import { ThemeProvider } from '@/lib/theme'
import './index.css'

if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search)
    const debugEnabled = params.get('debug') === '1' || window.localStorage.getItem('cv:debug') === 'true'
    const needsAlchemyRewrite = true
    if ((debugEnabled || needsAlchemyRewrite) && !(window as any).__cvFetchPatched) {
      const originalFetch = window.fetch.bind(window)
      const alchemyBaseRpc = /(^|\/\/)base-mainnet\.g\.alchemy\.com/i
      const safeBaseRpc = '/api/rpc'
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (debugEnabled && url.includes('https://auth.privy.io/api/v1/analytics_events')) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        if (alchemyBaseRpc.test(url)) {
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
