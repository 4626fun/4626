import { useQuery } from '@tanstack/react-query'
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'

import { ROBINHOOD_REMOTE_SHARE_OFT } from '@/config/remoteShareOftChains'
import { BASE_DEFAULTS } from '@/config/contracts.defaults'
import { readRobinhoodShareMeshWiringStatus } from '@/lib/deploy/robinhoodShareBridgeWiring'
import type { ShareBridgeReadClient } from '@/lib/deploy/shareBridgeReadClient'

const robinhoodChain = {
  id: ROBINHOOD_REMOTE_SHARE_OFT.chainId,
  name: ROBINHOOD_REMOTE_SHARE_OFT.shortName,
  nativeCurrency: ROBINHOOD_REMOTE_SHARE_OFT.nativeCurrency,
  rpcUrls: {
    default: { http: [ROBINHOOD_REMOTE_SHARE_OFT.defaultRpcUrl] },
  },
} as const

type RemoteShareBridgePanelProps = {
  enabled: boolean
  basePublicClient: ShareBridgeReadClient | null | undefined
  creatorToken: Address | null | undefined
  baseShareOft: Address | null | undefined
  robinhoodShareOft?: Address | null
  registryAddress?: Address
  hubGaugeReceiver?: Address | null
}

function toneClass(ok: boolean | null): string {
  if (ok === true) return 'text-emerald-300/80'
  if (ok === false) return 'text-amber-300/90'
  return 'text-zinc-500'
}

export function RemoteShareBridgePanel({
  enabled,
  basePublicClient,
  creatorToken,
  baseShareOft,
  robinhoodShareOft = null,
  registryAddress = getAddress(BASE_DEFAULTS.registry as Address),
  hubGaugeReceiver = null,
}: RemoteShareBridgePanelProps) {
  const robinhoodRpc =
    import.meta.env.VITE_ROBINHOOD_RPC_URL?.trim() || ROBINHOOD_REMOTE_SHARE_OFT.defaultRpcUrl

  const wiringQuery = useQuery({
    queryKey: [
      'remoteShareBridgeRobinhood',
      creatorToken,
      baseShareOft,
      robinhoodShareOft,
      registryAddress,
      hubGaugeReceiver,
      robinhoodRpc,
    ],
    enabled: Boolean(
      enabled &&
        basePublicClient &&
        creatorToken &&
        baseShareOft &&
        robinhoodShareOft &&
        isAddress(robinhoodShareOft),
    ),
    staleTime: 20_000,
    retry: 0,
    queryFn: async () => {
      if (!basePublicClient) {
        throw new Error('Base public client unavailable')
      }
      const robinhoodClient = createPublicClient({
        chain: robinhoodChain,
        transport: http(robinhoodRpc, { timeout: 30_000 }),
      })
      return readRobinhoodShareMeshWiringStatus({
        baseClient: basePublicClient,
        robinhoodClient: {
          readContract: robinhoodClient.readContract.bind(robinhoodClient),
          getChainId: async () => BigInt(await robinhoodClient.getChainId()),
        },
        registryAddress,
        creatorToken: creatorToken as Address,
        baseShareOft: baseShareOft as Address,
        robinhoodShareOft: getAddress(robinhoodShareOft as Address),
        hubGaugeReceiver: hubGaugeReceiver ?? undefined,
      })
    },
  })

  if (!enabled) {
    return (
      <div className="rounded-md border border-white/8 bg-black/5 px-3 py-2 text-[10px] text-zinc-600">
        {ROBINHOOD_REMOTE_SHARE_OFT.label} lane is disabled for this deployment profile.
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-500/15 bg-amber-500/[0.03] px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div>
          <div className="font-medium text-amber-200/90">{ROBINHOOD_REMOTE_SHARE_OFT.label}</div>
          <div className="mt-0.5 text-zinc-500">
            Bridge shares only on Robinhood Chain — no vault deposits or strategies. Fees and lottery settle on{' '}
            {ROBINHOOD_REMOTE_SHARE_OFT.settlementHub}.
          </div>
        </div>
        {wiringQuery.data ? (
          <div className={wiringQuery.data.ready ? 'text-emerald-300/80' : 'text-amber-300/90'}>
            {wiringQuery.data.ready ? 'verified' : 'needs attention'}
          </div>
        ) : null}
      </div>

      {!baseShareOft || !creatorToken ? (
        <div className="text-[10px] text-zinc-500">Loads after Base ShareOFT addresses resolve.</div>
      ) : !robinhoodShareOft ? (
        <div className="text-[10px] text-zinc-500">
          Remote Robinhood ShareOFT not configured yet. Deploy via{' '}
          <span className="font-mono">DeployRemoteShareOft.s.sol</span> then run{' '}
          <span className="font-mono">ops:verify-robinhood-mesh</span>.
        </div>
      ) : wiringQuery.isLoading || wiringQuery.isFetching ? (
        <div className="text-[10px] text-zinc-500">Checking endpoint, peers, and fee quotes…</div>
      ) : wiringQuery.isError || !wiringQuery.data ? (
        <div className="text-[10px] text-amber-300/90">
          Robinhood mesh verification failed. Peer or endpoint checks did not complete — do not enable user-facing
          bridge flows until{' '}
          <span className="font-mono">pnpm -C frontend ops:verify-robinhood-mesh</span> passes.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            {wiringQuery.data.checks.map((check) => (
              <div key={check.id} className={toneClass(check.ok)}>
                {check.id}: {check.ok ? 'ok' : check.detail}
              </div>
            ))}
          </div>
          {!wiringQuery.data.ready ? (
            <div className="text-[10px] text-amber-300/90">
              Warning: peer or endpoint verification failed. Fix wiring on Base and Robinhood before opening the remote
              bridge lane.
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export function isRemoteRobinhoodShareMeshEnabled(): boolean {
  return import.meta.env.VITE_REMOTE_ROBINHOOD_SHARE_OFT_ENABLED === 'true'
}
