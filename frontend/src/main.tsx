import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { RootRouter } from './RootRouter'
import { ThemeProvider } from '@/lib/ui/theme'
import { ThemeProvider as CdsThemeProvider, MediaQueryProvider as CdsMediaQueryProvider } from '@coinbase/cds-web/system'
import { PortalProvider as CdsPortalProvider } from '@coinbase/cds-web/overlays'
import { CdsToastBridge } from '@/components/ui/Toast'
import { theme4626 } from '@/theme/cds-theme'
import { privyAnalyticsFlag } from '@/lib/flags/featureFlags'
import {
  getPrivyPasswordlessBackoffMs,
  getPrivyPasswordlessFailureBackoffMs,
  isPrivyPasswordlessFailure,
  isPrivyPasswordlessInitRequest,
  normalizeFetchMethod,
} from '@/lib/privy/passwordlessFetchGuard'
import '@coinbase/cds-icons/fonts/web/icon-font.css'
import '@coinbase/cds-web/globalStyles'
import '@4626/brand-kit/styles'
import './index.css'
import '@google/model-viewer' // registers <model-viewer>; bundled so devtools don't resolve CDN maps under webRoot

function isLockedEthereumDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (!descriptor) return false
  if (typeof descriptor.get === 'function' && typeof descriptor.set !== 'function') return true
  if (Object.prototype.hasOwnProperty.call(descriptor, 'writable') && descriptor.writable === false) return true
  return false
}

function stabilizeWindowEthereumSlot() {
  if (typeof window === 'undefined') return
  try {
    // Some wallet stacks expose a locked `window.ethereum` descriptor (own or inherited).
    // Later provider assignment attempts then throw and can disrupt wallet boot.
    // Normalize it to a writable own data property when we safely can.
    const ownDescriptor = Object.getOwnPropertyDescriptor(window, 'ethereum')
    if (ownDescriptor && !isLockedEthereumDescriptor(ownDescriptor)) return

    let cursor: object | null = window
    let inheritedDescriptor: PropertyDescriptor | null = null
    while (!ownDescriptor && cursor) {
      const descriptor = Object.getOwnPropertyDescriptor(cursor, 'ethereum')
      if (descriptor) {
        inheritedDescriptor = descriptor
        break
      }
      cursor = Object.getPrototypeOf(cursor)
    }

    const lockedOwn = isLockedEthereumDescriptor(ownDescriptor)
    const lockedInherited = isLockedEthereumDescriptor(inheritedDescriptor ?? undefined)
    if (!lockedOwn && !lockedInherited) return
    if (ownDescriptor && ownDescriptor.configurable !== true) return

    let currentProvider: unknown = undefined
    try {
      currentProvider = (window as any).ethereum
    } catch {
      currentProvider = undefined
    }

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: currentProvider,
    })
  } catch {
    // ignore: best-effort hardening
  }
}

function stabilizeScrollMeasurementRoots() {
  if (typeof document === 'undefined') return
  try {
    const html = document.documentElement
    if (html && getComputedStyle(html).position === 'static') {
      html.style.position = 'relative'
    }

    const body = document.body
    if (body && getComputedStyle(body).position === 'static') {
      body.style.position = 'relative'
    }
  } catch {
    // ignore: best-effort setup for Motion's initial scroll measurements
  }
}

const EXTENSION_ETHEREUM_ERROR_PATTERNS: RegExp[] = [
  /Cannot redefine property:\s*ethereum/i,
  /Cannot set property ethereum of #<Window> which has only a getter/i,
  /MetaMask encountered an error setting the global Ethereum provider/i,
  /Failed to add embedded wallet connector:\s*Wallet proxy not initialized/i,
  /Cannot access '\$a' before initialization/i,
  /Failed to fetch dynamically imported module:\s*(chrome|moz)-extension:\/\//i,
]

const WALLET_COLLISION_SIGNAL_KEY = 'cv:wallet-provider-collision-at'
const VITE_OPTIMIZE_DEP_RECOVERY_KEY = 'cv:vite:optimize-dep-reload-at'
const VITE_OPTIMIZE_DEP_RECOVERY_WINDOW_MS = 15_000

function shouldSuppressWalletNoise(args: unknown[]): boolean {
  if (!args.length) return false
  const joined = args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message
      return String((arg as any)?.message ?? arg ?? '')
    })
    .join(' ')
    .toLowerCase()
  if (!joined) return false
  return (
    joined.includes('failed to add embedded wallet connector: wallet proxy not initialized') ||
    joined.includes('cannot set property ethereum of #<window> which has only a getter') ||
    joined.includes('embedded1193provider.request() called with args') ||
    joined.includes('eth_accounts for privy')
  )
}

function readErrorMessage(value: unknown): string {
  if (!value) return ''
  if (value instanceof Error) return value.message || ''
  return String((value as any)?.message ?? value)
}

function readErrorSource(value: unknown): string {
  if (!value) return ''
  const stack = String((value as any)?.stack ?? '').trim()
  if (stack) return stack
  return String(value)
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

function persistWalletCollisionSignal() {
  if (typeof window === 'undefined') return
  const timestamp = String(Date.now())
  const storages: Storage[] = []
  try {
    if (window.localStorage) storages.push(window.localStorage)
  } catch {
    // ignore
  }
  try {
    if (window.sessionStorage) storages.push(window.sessionStorage)
  } catch {
    // ignore
  }

  for (const storage of storages) {
    try {
      storage.setItem(WALLET_COLLISION_SIGNAL_KEY, timestamp)
    } catch {
      // ignore
    }
  }
}

function isViteOutdatedOptimizeDepError(message: string, source: string): boolean {
  const msg = message.toLowerCase()
  const src = source.toLowerCase()
  if (msg.includes('outdated optimize dep')) return true
  if (!msg.includes('failed to fetch dynamically imported module')) return false
  return msg.includes('/node_modules/.vite/deps/') || src.includes('/node_modules/.vite/deps/')
}

function isLoopbackHostname(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

function tryRecoverFromViteOptimizeDepError(message: string, source: string): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  if (!isViteOutdatedOptimizeDepError(message, source)) return false

  // Local dev often has extension-driven module noise; auto-reload here can feel
  // like a hard refresh loop. Keep recovery manual on loopback origins.
  if (isLoopbackHostname(window.location.hostname)) return false

  const path = String(window.location.pathname || '').toLowerCase()
  // Auto reload can feel like a refresh loop on auth-heavy routes.
  // Keep waitlist/telegram flows stable and let users retry in-place.
  if (path === '/waitlist' || path.startsWith('/waitlist/') || path.startsWith('/r/') || path.startsWith('/telegram/')) {
    return false
  }
  try {
    const last = Number(window.sessionStorage.getItem(VITE_OPTIMIZE_DEP_RECOVERY_KEY) ?? '0')
    const now = Date.now()
    if (Number.isFinite(last) && now - last < VITE_OPTIMIZE_DEP_RECOVERY_WINDOW_MS) return false
    window.sessionStorage.setItem(VITE_OPTIMIZE_DEP_RECOVERY_KEY, String(now))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

if (typeof window !== 'undefined') {
  try {
    stabilizeWindowEthereumSlot()
    stabilizeScrollMeasurementRoots()

    if (!(window as any).__cvWalletNoisePatched) {
      const originalLog = console.log.bind(console)
      const originalDebug = console.debug.bind(console)
      const originalError = console.error.bind(console)
      console.log = (...args: unknown[]) => {
        if (shouldSuppressWalletNoise(args)) return
        originalLog(...args)
      }
      console.debug = (...args: unknown[]) => {
        if (shouldSuppressWalletNoise(args)) return
        originalDebug(...args)
      }
      console.error = (...args: unknown[]) => {
        if (shouldSuppressWalletNoise(args)) return
        originalError(...args)
      }
      ;(window as any).__cvWalletNoisePatched = true
    }

    // Keep app rendering stable when multiple wallet extensions race to inject window.ethereum.
    window.addEventListener(
      'error',
      (event) => {
        if (tryRecoverFromViteOptimizeDepError(event.message || '', event.filename || '')) {
          event.preventDefault()
          return
        }
        if (isKnownExtensionWalletError(event.message || '', event.filename || '')) {
          persistWalletCollisionSignal()
          event.preventDefault()
        }
      },
      true,
    )
    window.addEventListener(
      'unhandledrejection',
      (event) => {
        const reason = (event as PromiseRejectionEvent).reason
        const message = readErrorMessage(reason)
        const source = readErrorSource(reason)
        if (tryRecoverFromViteOptimizeDepError(message, source)) {
          event.preventDefault()
          return
        }
        if (isKnownExtensionWalletError(message, source)) {
          persistWalletCollisionSignal()
          event.preventDefault()
        }
      },
      true,
    )

    const params = new URLSearchParams(window.location.search)
    const debugEnabled = params.get('debug') === '1' || window.localStorage.getItem('cv:debug') === 'true'
    const analyticsExplicitlyEnabled = privyAnalyticsFlag()
    const disablePrivyAnalytics =
      !analyticsExplicitlyEnabled ||
      debugEnabled ||
      params.get('privy_analytics') === '0' ||
      window.localStorage.getItem('cv:privy:analytics') === 'off'
    let privyPasswordlessCooldownUntilMs = 0
    let privyPasswordlessInFlight: Promise<Response> | null = null
    if (debugEnabled && !(window as any).__cvFetchPatched) {
      const originalFetch = window.fetch.bind(window)
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        const method = normalizeFetchMethod(init?.method ?? (input instanceof Request ? input.method : undefined))
        if (disablePrivyAnalytics && url.includes('https://auth.privy.io/api/v1/analytics_events')) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        if (isPrivyPasswordlessInitRequest(url, method)) {
          const now = Date.now()
          if (privyPasswordlessCooldownUntilMs > now) {
            const retryInSeconds = Math.max(1, Math.ceil((privyPasswordlessCooldownUntilMs - now) / 1_000))
            return Promise.reject(
              new Error(`Email verification is temporarily rate limited. Wait ${retryInSeconds}s and retry.`),
            )
          }
          if (privyPasswordlessInFlight) {
            return privyPasswordlessInFlight.then((response) => response.clone())
          }

          const request = originalFetch(input, init)
            .then((response) => {
              if (response.status === 429) {
                privyPasswordlessCooldownUntilMs = Date.now() + getPrivyPasswordlessBackoffMs(response)
              }
              return response
            })
            .catch((error) => {
              if (isPrivyPasswordlessFailure(error)) {
                privyPasswordlessCooldownUntilMs = Date.now() + getPrivyPasswordlessFailureBackoffMs()
              }
              throw error
            })
            .finally(() => {
              privyPasswordlessInFlight = null
            })

          privyPasswordlessInFlight = request
          return request.then((response) => response.clone())
        }
        return originalFetch(input, init)
      }
      ;(window as any).__cvFetchPatched = true
    }
  } catch {
    // ignore
  }
}

function redirectWwwToCanonicalApex(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.hostname !== 'www.4626.fun') return false
  const target = `https://4626.fun${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.replace(target)
  return true
}

if (!redirectWwwToCanonicalApex()) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <CdsMediaQueryProvider>
          <CdsThemeProvider theme={theme4626} activeColorScheme="dark">
            <CdsPortalProvider>
              <CdsToastBridge />
              <BrowserRouter>
                <RootRouter />
              </BrowserRouter>
            </CdsPortalProvider>
          </CdsThemeProvider>
        </CdsMediaQueryProvider>
      </ThemeProvider>
    </React.StrictMode>,
  )
}
