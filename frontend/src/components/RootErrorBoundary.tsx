/**
 * Top-level React error boundary for the entire application (L-19).
 *
 * Wraps the full React tree so a render error anywhere in the app falls
 * back to a graceful recovery UI instead of a blank white page. Logs the
 * error to the console (DevTools only) and, when available, to the
 * window-global monitoring hook registered by the observability layer.
 *
 * Design notes:
 *   - Matches the defensive pattern used in DeployVaultErrorBoundary
 *     (see frontend/src/pages/deploy/DeployVault.tsx): user-facing text
 *     is sanitized; raw error.message is only rendered under
 *     import.meta.env.DEV to avoid leaking internals.
 *   - Exposes handleRetry() which flips hasError back to false and
 *     forces a remount of the child subtree via retryKey.
 *   - Exposes handleReload() which triggers a full page reload as a
 *     last resort.
 *
 * Keep this deliberately dependency-free so it works even when other
 * providers (Privy, CDS, query client) fail to initialize.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type RootErrorBoundaryProps = {
  children: ReactNode
}

type RootErrorBoundaryState = {
  hasError: boolean
  error: Error | null
  retryKey: number
}

type MonitoringHook = (error: Error, info: ErrorInfo) => void
const DYNAMIC_IMPORT_RECOVERY_KEY = 'cv:root-boundary:dynamic-import-reload-at'
const DYNAMIC_IMPORT_RECOVERY_COUNT_KEY = 'cv:root-boundary:dynamic-import-reload-count'
const DYNAMIC_IMPORT_RECOVERY_WINDOW_MS = 15_000
const DYNAMIC_IMPORT_RECOVERY_MAX_RELOADS = 3

function isDynamicImportFetchError(error: Error): boolean {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk')
  )
}

function shouldReloadForDynamicImportError(error: Error): boolean {
  if (typeof window === 'undefined') return false
  if (!isDynamicImportFetchError(error)) return false
  try {
    const last = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RECOVERY_KEY) ?? '0')
    const count = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RECOVERY_COUNT_KEY) ?? '0')
    const now = Date.now()
    const withinWindow = Number.isFinite(last) && now - last < DYNAMIC_IMPORT_RECOVERY_WINDOW_MS
    if (withinWindow && Number.isFinite(count) && count >= DYNAMIC_IMPORT_RECOVERY_MAX_RELOADS) return false
    window.sessionStorage.setItem(DYNAMIC_IMPORT_RECOVERY_KEY, String(now))
    window.sessionStorage.setItem(
      DYNAMIC_IMPORT_RECOVERY_COUNT_KEY,
      String(withinWindow && Number.isFinite(count) ? count + 1 : 1),
    )
    return true
  } catch {
    return false
  }
}

function reloadWithCacheBuster(): void {
  if (typeof window === 'undefined') return
  try {
    const next = new URL(window.location.href)
    next.searchParams.set('__cv_reload', String(Date.now()))
    window.location.replace(next.toString())
  } catch {
    window.location.reload()
  }
}

function reportToMonitoring(error: Error, info: ErrorInfo): void {
  try {
    if (typeof window === 'undefined') return
    const hook = (window as unknown as { __4626_onRootError?: MonitoringHook })
      .__4626_onRootError
    if (typeof hook === 'function') {
      hook(error, info)
    }
  } catch {
    // Monitoring must never throw into the boundary.
  }
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, retryKey: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<RootErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Console log is visible to developers (DevTools) only — never in the DOM.
    console.error('[RootErrorBoundary] uncaught render error', error, errorInfo)
    reportToMonitoring(error, errorInfo)
    if (shouldReloadForDynamicImportError(error)) {
      window.setTimeout(reloadWithCacheBuster, 50)
    }
  }

  handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryKey: prev.retryKey + 1,
    }))
  }

  handleReload = (): void => {
    reloadWithCacheBuster()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const showRawForDev = import.meta.env.DEV && this.state.error?.message
      const isDynamicImportError = this.state.error ? isDynamicImportFetchError(this.state.error) : false
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            minHeight: '100vh',
            backgroundColor: '#0a0a0a',
            color: '#f4f4f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily:
              '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div style={{ maxWidth: '36rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: '#71717a' }}>
              APPLICATION ERROR
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 500 }}>
              {isDynamicImportError ? 'Reload needed' : 'Something went wrong'}
            </div>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#a1a1aa' }}>
              {isDynamicImportError
                ? 'The dev server updated while this page was loading. Your wallet and account are unaffected. Reload the page to fetch the latest app modules.'
                : 'The app ran into an unexpected error. Your wallet and account are unaffected. Try again, or reload the page if the issue persists.'}
            </div>
            {showRawForDev ? (
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  color: '#71717a',
                  wordBreak: 'break-all',
                }}
              >
                [dev-only] {this.state.error?.message}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={this.handleRetry}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: '1px solid #3b82f6',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'transparent',
                  color: '#f4f4f5',
                  border: '1px solid #3f3f46',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    // retryKey remount forces children to re-initialize on retry.
    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}
