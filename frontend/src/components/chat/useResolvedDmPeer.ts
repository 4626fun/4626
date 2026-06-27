import { useEffect, useRef, useState } from 'react'
import { useXmtp } from '@/lib/xmtp/provider'

type ResolvedDmPeerParams = {
  peerAddress?: string | null
  peerInboxId?: string | null
  enabled?: boolean
}

export function useResolvedDmPeer(params: ResolvedDmPeerParams): {
  peerAddress: string | null
  resolving: boolean
} {
  const enabled = params.enabled !== false
  const { resolveInboxAddress } = useXmtp()
  const [resolvedPeer, setResolvedPeer] = useState<{ inboxId: string; address: string | null } | null>(null)
  const resolvingInboxIdRef = useRef<string | null>(null)

  const normalizedPeerAddress = params.peerAddress?.trim().toLowerCase() ?? null
  const peerInboxId = params.peerInboxId?.trim() ?? null

  const needsResolution =
    enabled &&
    !normalizedPeerAddress &&
    !!peerInboxId &&
    resolvedPeer?.inboxId !== peerInboxId

  useEffect(() => {
    if (!needsResolution || !peerInboxId) return
    if (resolvingInboxIdRef.current === peerInboxId) return

    let cancelled = false
    resolvingInboxIdRef.current = peerInboxId
    resolveInboxAddress(peerInboxId)
      .then((addr) => {
        if (cancelled) return
        const normalizedAddr = typeof addr === 'string' ? addr.toLowerCase() : null
        setResolvedPeer((prev) => {
          if (prev?.inboxId === peerInboxId && prev.address === normalizedAddr) return prev
          return { inboxId: peerInboxId, address: normalizedAddr }
        })
      })
      .catch(() => {
        if (cancelled) return
        setResolvedPeer((prev) => {
          if (prev?.inboxId === peerInboxId) return prev
          return { inboxId: peerInboxId, address: null }
        })
      })
      .finally(() => {
        if (resolvingInboxIdRef.current === peerInboxId) {
          resolvingInboxIdRef.current = null
        }
      })

    return () => {
      cancelled = true
    }
  }, [needsResolution, peerInboxId, resolveInboxAddress])

  const peerAddress =
    normalizedPeerAddress ??
    (peerInboxId && resolvedPeer?.inboxId === peerInboxId ? resolvedPeer.address : null)

  return { peerAddress, resolving: needsResolution }
}
