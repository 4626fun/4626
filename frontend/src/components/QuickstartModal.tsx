import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import {
  CheckCircle,
  Loader2,
  Rocket,
  User,
  Coins,
  Bot,
  Shield,
  X,
  ExternalLink,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { encodeFunctionData, getAddress } from 'viem'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type QuickstartData = {
  creatorAddress: string
  farcasterUsername: string | null
  farcasterPfp: string | null
  zoraProfile: { displayName: string | null; handle: string | null } | null
  coinAddress: string | null
  coinName: string | null
  coinSymbol: string | null
  agentType: 'csw' | 'eoa'
  agentAddress: string
  serverSignerAddress: string | null
  serverSignerWalletId: string | null
  ownerAdded: boolean
  vaultConfigCreated: boolean
  allowlisted: boolean
  pendingActions: string[]
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cv:quickstart:v1'

function hasCompletedQuickstart(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markQuickstartDone() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// CSW ABI
// ---------------------------------------------------------------------------

const CSW_ABI = [
  {
    type: 'function' as const,
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'owner', type: 'address' as const }],
    outputs: [],
  },
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function StepRow({
  done,
  loading,
  label,
  detail,
  icon: Icon,
}: {
  done: boolean
  loading?: boolean
  label: string
  detail?: string | null
  icon: typeof CheckCircle
}) {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3 py-1.5 sm:py-2">
      <div
        className={`mt-0.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 ${
          done
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : loading
              ? 'bg-indigo-500/10 border border-indigo-500/30'
              : 'bg-zinc-800 border border-zinc-700'
        }`}
      >
        {loading ? (
          <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-400 animate-spin" />
        ) : done ? (
          <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
        ) : (
          <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[12px] sm:text-xs font-medium ${done ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</div>
        {detail && <div className="text-[10px] sm:text-[10px] text-zinc-600 mt-0.5 break-all sm:truncate leading-snug">{detail}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickstartModal({ onClose }: { onClose: () => void }) {
  const { address } = useAccount()
  const { authAddress } = useSiweAuth()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const creatorAddress = useMemo(() => {
    const addr = authAddress ?? address
    return addr ? String(addr).toLowerCase() : null
  }, [authAddress, address])

  // -----------------------------------------------------------------------
  // Step 1: Call quickstart endpoint
  // -----------------------------------------------------------------------
  const quickstartMutation = useMutation({
    mutationFn: async (): Promise<QuickstartData> => {
      const res = await apiFetch('/api/v1/creators/quickstart', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<QuickstartData> | null
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? 'Quickstart failed')
      }
      return json.data
    },
  })

  const data = quickstartMutation.data

  // Auto-trigger on mount
  useEffect(() => {
    if (creatorAddress && !quickstartMutation.data && !quickstartMutation.isPending) {
      void quickstartMutation.mutateAsync()
    }
  }, [creatorAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Step 2: Add owner (if needed)
  // -----------------------------------------------------------------------
  const [ownerTxDone, setOwnerTxDone] = useState(false)

  const addOwnerMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient || !creatorAddress || !data?.serverSignerAddress) {
        throw new Error('Wallet not connected')
      }
      const calldata = encodeFunctionData({
        abi: CSW_ABI,
        functionName: 'addOwnerAddress',
        args: [getAddress(data.serverSignerAddress) as `0x${string}`],
      })
      const hash = await walletClient.sendTransaction({
        to: getAddress(creatorAddress) as `0x${string}`,
        data: calldata,
        chain: walletClient.chain,
      })
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      setOwnerTxDone(true)
      return hash
    },
  })

  const needsOwnerTx = data && !data.ownerAdded && data.serverSignerAddress && !ownerTxDone
  const allDone = data && (data.ownerAdded || ownerTxDone || data.agentType === 'eoa')

  // -----------------------------------------------------------------------
  // Derived display values
  // -----------------------------------------------------------------------
  const displayName = useMemo(() => {
    if (data?.farcasterUsername) return `@${data.farcasterUsername}`
    if (data?.zoraProfile?.handle) return `@${data.zoraProfile.handle}`
    if (data?.zoraProfile?.displayName) return data.zoraProfile.displayName
    if (creatorAddress) return truncAddr(creatorAddress)
    return 'Creator'
  }, [data, creatorAddress])

  const avatarUrl = data?.farcasterPfp ?? null

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  function handleClose() {
    markQuickstartDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 border-b-0 sm:border-b bg-[#0a0a0a] shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-2 sm:pb-3 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[13px] sm:text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-[10px] text-zinc-500">Creator Quickstart</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drag handle on mobile */}
        <div className="flex justify-center py-1 sm:hidden">
          <div className="w-8 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Body — scrollable */}
        <div className="px-4 sm:px-5 pb-5 overflow-auto flex-1 -webkit-overflow-scrolling-touch">
          {quickstartMutation.isPending && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-400 animate-spin" />
              <div className="text-[12px] sm:text-xs text-zinc-400">Setting up your creator account...</div>
            </div>
          )}

          {quickstartMutation.isError && (
            <div className="py-6 space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <span className="text-[12px] sm:text-xs text-red-300">
                  {(quickstartMutation.error as Error)?.message ?? 'Something went wrong'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void quickstartMutation.mutateAsync()}
                className="text-[12px] sm:text-xs px-4 py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-3 sm:space-y-4">
              {/* Auto-detected steps */}
              <div className="space-y-0">
                <StepRow
                  done
                  icon={User}
                  label="Identity resolved"
                  detail={[
                    data.farcasterUsername ? `FC: @${data.farcasterUsername}` : null,
                    data.zoraProfile?.handle ? `Zora: @${data.zoraProfile.handle}` : null,
                  ]
                    .filter(Boolean)
                    .join(' / ') || truncAddr(data.creatorAddress)}
                />

                <StepRow
                  done={Boolean(data.coinAddress)}
                  icon={Coins}
                  label={data.coinAddress ? 'Creator coin detected' : 'No creator coin found'}
                  detail={
                    data.coinAddress
                      ? `${data.coinName || data.coinSymbol || ''} (${truncAddr(data.coinAddress)})`
                      : 'Link one later in Admin'
                  }
                />

                <StepRow
                  done={data.allowlisted}
                  icon={Shield}
                  label={data.allowlisted ? 'Access granted' : 'Access pending'}
                  detail={data.allowlisted ? 'Auto-allowlisted' : null}
                />

                <StepRow
                  done={Boolean(data.serverSignerAddress)}
                  icon={Bot}
                  label="Wallet provisioned"
                  detail={
                    data.agentType === 'csw'
                      ? `Smart Wallet: ${truncAddr(data.agentAddress)}`
                      : `User Wallet: ${truncAddr(data.agentAddress)}`
                  }
                />

                <StepRow
                  done={data.ownerAdded || ownerTxDone}
                  loading={addOwnerMutation.isPending}
                  icon={Shield}
                  label={
                    data.ownerAdded || ownerTxDone
                      ? 'Server signer authorized'
                      : 'Authorize server signer'
                  }
                  detail={
                    data.ownerAdded || ownerTxDone
                      ? 'Can sign XMTP messages on your behalf'
                      : data.serverSignerAddress
                        ? `Add ${truncAddr(data.serverSignerAddress)} as CSW owner`
                        : null
                  }
                />
              </div>

              {/* Action button */}
              {needsOwnerTx && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void addOwnerMutation.mutateAsync()}
                    disabled={addOwnerMutation.isPending || !walletClient}
                    className="w-full flex items-center justify-center gap-2 text-[13px] sm:text-sm px-4 py-3 sm:py-3 rounded-xl bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 border border-indigo-500/20 text-white font-medium hover:from-indigo-500/30 hover:to-emerald-500/30 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {addOwnerMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Confirming...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" /> Activate (1 tx)
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-600 text-center px-2">
                    Adds a server signer as owner of your Smart Wallet so it can respond to messages.
                  </p>
                </div>
              )}

              {addOwnerMutation.isError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] sm:text-xs text-red-300 break-all">{(addOwnerMutation.error as Error)?.message}</span>
                </div>
              )}

              {allDone && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 sm:p-4 text-center">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mx-auto mb-1.5 sm:mb-2" />
                    <div className="text-[13px] sm:text-sm font-medium text-white">You're all set!</div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Your agent is live and will respond to messages in your vault chat.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://xmtp.chat/dm/${data.agentAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs px-3 py-2.5 sm:py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Test on XMTP <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 text-[11px] sm:text-xs px-3 py-2.5 sm:py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hook: should we show quickstart?
// ---------------------------------------------------------------------------

export function useShowQuickstart(): boolean {
  const { address } = useAccount()
  const { authAddress } = useSiweAuth()
  const [dismissed] = useState(() => hasCompletedQuickstart())

  const connected = Boolean(address)
  const authenticated = Boolean(authAddress)

  return connected && authenticated && !dismissed
}
