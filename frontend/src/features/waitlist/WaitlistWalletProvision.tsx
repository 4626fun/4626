import { useCallback, useEffect, useRef } from 'react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { Button } from '@/components/ui/Button'
import { useAccountMe } from '@/hooks/useAccountMe'
import { SmartWalletsRouteProvider } from '@/lib/privy/SmartWalletsRouteProvider'

import { useEnsurePrivySmartWallet } from './useEnsurePrivySmartWallet'

type WaitlistWalletProvisionProps = {
  enabled: boolean
  needsProvision: boolean
}

function WaitlistWalletProvisionInner(props: WaitlistWalletProvisionProps) {
  const { refresh, me } = useAccountMe()
  const { busy, error, ensurePrivyWallets } = useEnsurePrivySmartWallet({ enabled: props.enabled })
  const autoStartedRef = useRef(false)

  const runProvision = useCallback(async () => {
    const result = await ensurePrivyWallets()
    if (result.ok) {
      refresh()
    }
    return result
  }, [ensurePrivyWallets, refresh])

  useEffect(() => {
    if (!props.enabled || !props.needsProvision) return
    if (autoStartedRef.current) return
    if (me?.accountSignals?.canonicalCswAddress?.trim()) return
    autoStartedRef.current = true
    void runProvision()
  }, [me?.accountSignals?.canonicalCswAddress, props.enabled, props.needsProvision, runProvision])

  if (!props.enabled || !props.needsProvision) return null

  const canonical = me?.accountSignals?.canonicalCswAddress?.trim()
  if (canonical) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100/90">
        Your 4626 wallet is ready at{' '}
        <span className="font-mono text-emerald-50">{canonical}</span>.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-200">Creating your 4626 wallet</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          We create a Base smart wallet for you so you can enable signing and join waitlist chat.
        </p>
      </div>
      {busy ? <LoadingInline labelOverride="Provisioning wallet…" /> : null}
      {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
      {me?.accountSignals?.walletHydrationError ? (
        <p className="text-xs text-amber-200/90">{me.accountSignals.walletHydrationError}</p>
      ) : null}
      {!busy ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => void runProvision()}>
          Retry wallet setup
        </Button>
      ) : null}
    </div>
  )
}

/** Route-scoped smart-wallet provisioning for email-only waitlist users. */
export function WaitlistWalletProvision(props: WaitlistWalletProvisionProps) {
  if (!props.enabled) return null
  return (
    <SmartWalletsRouteProvider>
      <WaitlistWalletProvisionInner {...props} />
    </SmartWalletsRouteProvider>
  )
}
