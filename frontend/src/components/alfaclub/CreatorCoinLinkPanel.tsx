import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Circle, Link2, Loader2 } from 'lucide-react'
import { formatUnits, getAddress, isAddress, type Address, type WalletClient } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient, useWalletClient } from 'wagmi'

import { CONTRACTS } from '@/config/contracts'
import {
  isAlfaClubSudoswapMarketConfigured,
  readAlfaClubLiquidityPools,
  type AlfaClubSudoswapMarketConfig,
} from '@/hooks/useAlfaClubLiquidityPools'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { cn } from '@/lib/shared/utils'
import { useAccountContext } from '@/wallet/accountContext'

type CreatorCoinLinkStatus =
  | 'verified_owner'
  | 'managed_by_policy_controller'
  | 'control_not_verified'
  | 'claimed_by_another_account'

type CreatorCoinLink = {
  creatorCoinAddress: Address
  executionAddress: Address
  verificationMethod: 'direct_owner' | 'policy_controller'
  verificationBlock: string
  coinName: string
  coinSymbol: string
  coinDecimals: number
  owners: Address[]
  creatorCoinPayoutRecipient: Address
  policyControllerAddress: Address | null
}

type CreatorCoinInspection = CreatorCoinLink & {
  status: CreatorCoinLinkStatus
  verificationMethod: 'direct_owner' | 'policy_controller' | null
  existingLink: CreatorCoinLink | null
}

type StatusResponse = {
  status: CreatorCoinLinkStatus | null
  link: CreatorCoinLink | null
}

type ChallengeResponse = {
  inspection: CreatorCoinInspection
  challenge: {
    nonce: string
    message: string
    expiresAt: string
  }
}

type Readiness = {
  inventoryAvailable: boolean
  creatorCoinBalance: bigint
  keyBalance: bigint
  adapterMarketAllowed: boolean
  marketReady: boolean
}

const MARKET_CONFIG: AlfaClubSudoswapMarketConfig = {
  pair: CONTRACTS.room1659SudoswapPair as Address,
  adapter: CONTRACTS.alfaClubSudoswapAdapter as Address,
  router: CONTRACTS.alfaClubUniversalRouter as Address,
  permit2: CONTRACTS.permit2 as Address,
  factory: CONTRACTS.sudoswapPairFactory as Address,
  curve: CONTRACTS.sudoswapXykCurve as Address,
}

const EMPTY_READINESS: Readiness = {
  inventoryAvailable: false,
  creatorCoinBalance: 0n,
  keyBalance: 0n,
  adapterMarketAllowed: false,
  marketReady: false,
}

const STATUS_COPY: Record<
  CreatorCoinLinkStatus,
  { label: string; detail: string; tone: 'success' | 'warning' | 'danger' }
> = {
  verified_owner: {
    label: 'Verified owner',
    detail: 'Your execution address can administer this Creator Coin.',
    tone: 'success',
  },
  managed_by_policy_controller: {
    label: 'Managed by your 4626 policy controller',
    detail: 'This coin is already managed by the policy controller from your vault deployment.',
    tone: 'success',
  },
  control_not_verified: {
    label: 'Control not verified',
    detail: 'The current execution address cannot prove Creator Coin admin authority.',
    tone: 'warning',
  },
  claimed_by_another_account: {
    label: 'Claimed by another account',
    detail: 'This room or Creator Coin is already linked. Contact support for account recovery.',
    tone: 'danger',
  },
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: T
    error?: string
    message?: string
  } | null
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.message ?? payload?.error ?? `request_failed_${response.status}`)
  }
  return payload.data
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatBalance(value: bigint, decimals: number): string {
  const numeric = Number(formatUnits(value, decimals))
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function normalizeAddressInput(value: string): Address | null {
  const trimmed = value.trim()
  return isAddress(trimmed) ? (getAddress(trimmed).toLowerCase() as Address) : null
}

function StatusBadge({ status }: { status: CreatorCoinLinkStatus }) {
  const copy = STATUS_COPY[status]
  const Icon = copy.tone === 'success' ? CheckCircle2 : AlertTriangle
  return (
    <div
      role={copy.tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl px-3 py-3 ring-1',
        copy.tone === 'success' && 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/20',
        copy.tone === 'warning' && 'bg-amber-500/10 text-amber-100 ring-amber-400/20',
        copy.tone === 'danger' && 'bg-red-500/10 text-red-100 ring-red-400/20',
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" aria-hidden />
        {copy.label}
      </p>
      <p className="mt-1 text-xs opacity-80">{copy.detail}</p>
    </div>
  )
}

function ReadinessItem({
  ready,
  label,
  detail,
}: {
  ready: boolean
  label: string
  detail: string
}) {
  const Icon = ready ? CheckCircle2 : Circle
  return (
    <li className="flex gap-2.5">
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', ready ? 'text-emerald-300' : 'text-zinc-600')}
        aria-hidden
      />
      <span>
        <span className="block text-xs font-medium text-zinc-200">{label}</span>
        <span className="block text-[11px] text-zinc-500">{detail}</span>
      </span>
    </li>
  )
}

async function signChallenge(params: {
  walletClient: WalletClient
  signerAddress: Address
  message: string
}): Promise<`0x${string}`> {
  return params.walletClient.signMessage({
    account: params.signerAddress,
    message: params.message,
  })
}

export function CreatorCoinLinkPanel({
  roomId,
  onOpenLiquidity,
}: {
  roomId: string
  onOpenLiquidity: () => void
}) {
  const auth = useSiweAuth()
  const accountContext = useAccountContext()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const executionAddress = (accountContext.activeAccount ??
    accountContext.signerAddress ??
    null) as Address | null
  const signerAddress = accountContext.signerAddress ?? null
  const [creatorCoinInput, setCreatorCoinInput] = useState('')
  const [status, setStatus] = useState<CreatorCoinLinkStatus | null>(null)
  const [inspection, setInspection] = useState<CreatorCoinInspection | null>(null)
  const [linkedCoin, setLinkedCoin] = useState<CreatorCoinLink | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const creatorCoinAddress = useMemo(
    () => normalizeAddressInput(creatorCoinInput),
    [creatorCoinInput],
  )

  useEffect(() => {
    if (!auth.hasSession) {
      setStatus(null)
      setLinkedCoin(null)
      return
    }
    const controller = new AbortController()
    setLoadingStatus(true)
    void apiFetch(
      `${API_ENDPOINTS.alfaclub.creatorCoinStatus}?roomId=${encodeURIComponent(roomId)}`,
      { method: 'GET', signal: controller.signal },
    )
      .then((response) => readJson<StatusResponse>(response))
      .then((data) => {
        if (controller.signal.aborted) return
        setStatus(data.status)
        setLinkedCoin(data.link)
        if (data.link) setCreatorCoinInput(data.link.creatorCoinAddress)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load Creator Coin status')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStatus(false)
      })
    return () => controller.abort()
  }, [auth.hasSession, roomId])

  const effectiveCoin = linkedCoin?.creatorCoinAddress ?? inspection?.creatorCoinAddress ?? null
  const readinessQuery = useQuery({
    queryKey: ['alfaclub-creator-coin-readiness', roomId, effectiveCoin, executionAddress],
    enabled: Boolean(
      publicClient &&
        effectiveCoin &&
        /^\d+$/.test(roomId) &&
        isAlfaClubSudoswapMarketConfigured(MARKET_CONFIG),
    ),
    staleTime: 12_000,
    queryFn: async (): Promise<Readiness> => {
      if (!publicClient || !effectiveCoin || !/^\d+$/.test(roomId)) {
        return EMPTY_READINESS
      }
      const tokenId = BigInt(roomId)
      const directory = await readAlfaClubLiquidityPools(publicClient, MARKET_CONFIG)
      const market = directory.pools.find(
        (candidate) =>
          candidate.tokenId === tokenId &&
          candidate.creatorCoin.toLowerCase() === effectiveCoin.toLowerCase(),
      )
      if (!market) return EMPTY_READINESS
      return {
        inventoryAvailable: market.creatorCoinBalance > 0n && market.keyBalance > 0n,
        creatorCoinBalance: market.creatorCoinBalance,
        keyBalance: market.keyBalance,
        adapterMarketAllowed: market.adapterMarketAllowed,
        marketReady: market.configurationReady,
      }
    },
  })

  const validate = async () => {
    if (!creatorCoinAddress || !executionAddress) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await apiFetch(API_ENDPOINTS.alfaclub.creatorCoinStatus, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          creatorCoinAddress,
          executionAddress,
        }),
      })
      const data = await readJson<CreatorCoinInspection>(response)
      setInspection(data)
      setStatus(data.status)
      setLinkedCoin(data.existingLink ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to validate Creator Coin')
    } finally {
      setSubmitting(false)
    }
  }

  const signAndLink = async () => {
    if (!creatorCoinAddress || !executionAddress || !signerAddress || !walletClient) return
    setSubmitting(true)
    setError(null)
    try {
      const challengeResponse = await apiFetch(API_ENDPOINTS.alfaclub.creatorCoinChallenge, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, creatorCoinAddress, executionAddress }),
      })
      const challengeData = await readJson<ChallengeResponse>(challengeResponse)
      const signature = await signChallenge({
        walletClient,
        signerAddress,
        message: challengeData.challenge.message,
      })
      const verifyResponse = await apiFetch(API_ENDPOINTS.alfaclub.creatorCoinVerify, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nonce: challengeData.challenge.nonce,
          signature,
        }),
      })
      const verified = await readJson<{ status: CreatorCoinLinkStatus; link: CreatorCoinLink }>(
        verifyResponse,
      )
      setLinkedCoin(verified.link)
      setInspection(null)
      setStatus(verified.status)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to link Creator Coin')
    } finally {
      setSubmitting(false)
    }
  }

  const displayCoin = linkedCoin ?? inspection
  const canSign =
    inspection?.verificationMethod !== null &&
    (status === 'verified_owner' || status === 'managed_by_policy_controller') &&
    !linkedCoin
  const readiness = readinessQuery.data ?? EMPTY_READINESS

  return (
    <section
      className="border-t border-white/[0.07] pt-8"
      aria-labelledby="creator-coin-link-title"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">
            Creator Coin
          </p>
          <h2 id="creator-coin-link-title" className="mt-2 text-lg font-semibold text-zinc-100">
            Add Creator Coin
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Prove control and attach your Base Creator Coin to this room. Linking does not change
            ownership or the creatorCoinPayoutRecipient.
          </p>

          {!auth.hasSession ? (
            <p className="mt-5 rounded-xl bg-white/[0.03] p-4 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
              Sign in to verify a Creator Coin for your room.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-zinc-300">Base Creator Coin address</span>
                <input
                  type="text"
                  inputMode="text"
                  value={creatorCoinInput}
                  onChange={(event) => {
                    setCreatorCoinInput(event.target.value)
                    setInspection(null)
                    if (!linkedCoin) setStatus(null)
                  }}
                  disabled={Boolean(linkedCoin)}
                  placeholder="0x…"
                  className="mt-2 w-full rounded-xl bg-black/45 px-3 py-2.5 font-mono text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/40 disabled:text-zinc-500"
                />
              </label>

              {loadingStatus ? (
                <p className="flex items-center gap-2 text-xs text-zinc-500" role="status">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Loading link status
                </p>
              ) : null}
              {status ? <StatusBadge status={status} /> : null}
              {displayCoin ? (
                <dl className="grid gap-2 rounded-xl bg-black/30 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Token</dt>
                    <dd className="mt-0.5 text-zinc-200">
                      {displayCoin.coinName} ({displayCoin.coinSymbol}) · {displayCoin.coinDecimals}{' '}
                      decimals
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Verified at block</dt>
                    <dd className="mt-0.5 font-mono text-zinc-200">
                      {displayCoin.verificationBlock}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Owner</dt>
                    <dd className="mt-0.5 font-mono text-zinc-200">
                      {displayCoin.policyControllerAddress
                        ? shortAddress(displayCoin.policyControllerAddress)
                        : displayCoin.owners.map(shortAddress).join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">creatorCoinPayoutRecipient</dt>
                    <dd className="mt-0.5 font-mono text-zinc-200">
                      {shortAddress(displayCoin.creatorCoinPayoutRecipient)}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {error ? (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!linkedCoin ? (
                  <button
                    type="button"
                    onClick={() => void validate()}
                    disabled={!creatorCoinAddress || !executionAddress || submitting}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/[0.1] hover:bg-white/[0.1] disabled:text-zinc-600"
                  >
                    {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                    Validate control
                  </button>
                ) : null}
                {canSign ? (
                  <button
                    type="button"
                    onClick={() => void signAndLink()}
                    disabled={!walletClient || !signerAddress || submitting}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-400 disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    <Link2 className="size-3.5" aria-hidden />
                    Sign and link
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-white/[0.06]">
          <h3 className="text-sm font-semibold text-zinc-100">Market readiness</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Linking is separate from the official Sudoswap pair and adapter checks.
          </p>
          <ul className="mt-4 space-y-3">
            <ReadinessItem
              ready={Boolean(executionAddress)}
              label="Execution-ready wallet"
              detail={
                executionAddress ? shortAddress(executionAddress) : 'Connect a canonical CSW or EOA'
              }
            />
            <ReadinessItem
              ready={readiness.inventoryAvailable}
              label="Pair inventory"
              detail={`${formatBalance(readiness.creatorCoinBalance, displayCoin?.coinDecimals ?? 18)} ${displayCoin?.coinSymbol ?? 'Creator Coin'} · ${readiness.keyBalance.toLocaleString()} keys`}
            />
            <ReadinessItem
              ready={readiness.adapterMarketAllowed}
              label="Adapter market"
              detail="Pair, Creator Coin, and FriendKey token ID are bound in the adapter"
            />
            <ReadinessItem
              ready={readiness.marketReady}
              label="Official market"
              detail={
                readiness.marketReady
                  ? 'Factory, TRADE pair, and XYK curve checks pass'
                  : 'Trading remains disabled'
              }
            />
          </ul>
          <button
            type="button"
            onClick={onOpenLiquidity}
            disabled={!linkedCoin || !readiness.marketReady}
            className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/[0.08] hover:bg-white/[0.1] disabled:text-zinc-600"
          >
            Open room market
          </button>
        </aside>
      </div>
    </section>
  )
}

export { STATUS_COPY }
