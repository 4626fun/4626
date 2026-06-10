import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Bot,
  ChevronRight,
  PanelRightClose,
  Plus,
  Search,
  Sparkles,
  Star,
  Users,
  Wifi,
} from 'lucide-react'
import { useAccount } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import { BASE_XMTP_AGENTS, type BaseXmtpAgent } from '@/lib/chat/baseXmtpAgents'
import { CHAT_TOGGLE_REQUEST_EVENT, requestNewDm, requestOpenChat } from '@/lib/chat/openChat'
import { canMessageAddressOnCurrentEnv, useXmtp, type ChatConversation } from '@/lib/xmtp/provider'
import { getBasenameProfileByName, resolveBasenameAddress } from '@/lib/basename/basename-api'
import { cn } from '@/lib/shared/utils'
import { toast } from '@/components/ui/Toast'
import { CANONICAL_CSW_ADDRESS, CANONICAL_CSW_ALLOWED_OWNER_EOAS } from '@/wallet/canonicalWalletPolicy'
import { EthosAvatarScoreBadge, EthosAvatarScoreForAddress, getEthosScorePalette, useEthosScore } from './EthosScorePill'
import { useChatIdentity } from './useChatIdentity'

type AgentRow = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType?: 'eoa' | 'csw'
  cswAddress?: string | null
  listedPublicly: boolean
  createdAt: string
}

type AvailabilityUser = {
  address: `0x${string}`
  displayName?: string | null
  avatarUrl?: string | null
  ethosScore?: number | null
  ethosLevel?: string | null
  status: 'available' | 'recent'
  lastSeenAt: string | null
}

type AvailabilityResponse = {
  users: AvailabilityUser[]
  generatedAt: string
}

type AgentsResponse = {
  agents: AgentRow[]
}

const PRESENCE_OPT_IN_KEY = '4626.chat.presence.optedIn'
const RAIL_WIDTH_CLASS = 'w-[320px] xl:w-[336px]'
const CANONICAL_4626_MAIN_ACCOUNT = CANONICAL_CSW_ALLOWED_OWNER_EOAS[0]

type FriendState = 'none' | 'accepted' | 'pending_incoming' | 'pending_outgoing'

type FriendRecord = {
  address: `0x${string}`
  state: Exclude<FriendState, 'none'>
  updatedAt: string
}

type FriendsResponse = {
  friends: FriendRecord[]
  incoming: FriendRecord[]
  outgoing: FriendRecord[]
}

type FriendAction = 'send_request' | 'accept_request' | 'decline_request' | 'cancel_request' | 'remove_friend'

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function resolveAgentAddress(value: string | null | undefined): `0x${string}` | null {
  if (!isAddress(value)) return null
  return value.toLowerCase() as `0x${string}`
}

function isCanonical4626AgentAddress(value: string | null | undefined): boolean {
  return value?.toLowerCase() === CANONICAL_CSW_ADDRESS
}

function isCanonical4626MainAccount(value: string | null | undefined): boolean {
  return value?.toLowerCase() === CANONICAL_4626_MAIN_ACCOUNT
}

function isCanonical4626Agent(agent: AgentRow): boolean {
  return (
    isCanonical4626AgentAddress(agent.xmtpAgentAddress) ||
    isCanonical4626AgentAddress(agent.cswAddress) ||
    isCanonical4626AgentAddress(agent.creatorAddress)
  )
}

function getCreatorAgentDisplayGroupKey(agent: AgentRow): string {
  if (
    isCanonical4626Agent(agent) ||
    isCanonical4626MainAccount(agent.creatorAddress) ||
    isCanonical4626MainAccount(agent.cswAddress) ||
    isCanonical4626MainAccount(agent.xmtpAgentAddress)
  ) {
    return '4626-canonical-agent'
  }
  return agent.xmtpAgentAddress.toLowerCase()
}

function pickPreferredCreatorAgentRow(current: AgentRow | undefined, candidate: AgentRow): AgentRow {
  if (!current) return candidate
  const currentIsCanonical = isCanonical4626Agent(current)
  const candidateIsCanonical = isCanonical4626Agent(candidate)
  if (candidateIsCanonical && !currentIsCanonical) return candidate
  if (candidate.agentType === 'csw' && current.agentType !== 'csw') return candidate
  return current
}

function scoreRank(score: number | null | undefined): number {
  return typeof score === 'number' && Number.isFinite(score) ? score : -1
}

function initials(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '??'
  return trimmed.slice(0, 2).toUpperCase()
}

function RailSection(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-end justify-between gap-3 px-2">
        <div className="label text-[8px] tracking-[0.18em]">{props.label}</div>
        {props.hint ? <div className="text-[10px] text-zinc-600">{props.hint}</div> : null}
      </div>
      <div className="space-y-1">{props.children}</div>
    </section>
  )
}

function RailAvatar(props: {
  name: string
  imageUrl?: string | null
  icon?: ReactNode
  status?: 'available' | 'recent' | 'agent' | 'conversation'
  ethosAddress?: string | null
  ethosScore?: number | null
  ethosLevel?: string | null
}) {
  const dotClass =
    props.status === 'available' || props.status === 'agent'
      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)] motion-safe:animate-pulse'
      : props.status === 'recent'
        ? 'bg-amber-300'
        : 'bg-zinc-500'
  const fetchedEthosScore = useEthosScore(props.ethosScore === undefined ? props.ethosAddress : null)
  const effectiveEthosScore = props.ethosScore !== undefined ? props.ethosScore : fetchedEthosScore.data?.score
  const effectiveEthosLevel = props.ethosScore !== undefined ? props.ethosLevel : fetchedEthosScore.data?.level
  const ethosScoreValue = typeof effectiveEthosScore === 'number' ? effectiveEthosScore : null
  const ethosHasPositiveScore = ethosScoreValue != null && ethosScoreValue > 0
  const ethosPalette = getEthosScorePalette(ethosScoreValue, effectiveEthosLevel)
  const avatarRingClass = ethosHasPositiveScore ? ethosPalette.borderClass : 'border-white/10'

  return (
    <div className="relative h-[52px] w-11 shrink-0">
      <div className={`absolute left-1/2 top-0 h-10 w-10 -translate-x-1/2 overflow-hidden rounded-full border-2 bg-white/[0.06] ${avatarRingClass}`}>
        {props.imageUrl ? (
          <img src={props.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
            {props.icon ?? initials(props.name)}
          </div>
        )}
      </div>
      {props.status ? (
        <span
          className={cn(
            'absolute right-0.5 top-1 h-2.5 w-2.5 rounded-full border border-black/85 ring-1 ring-black/40',
            dotClass,
          )}
        />
      ) : null}
      <span className="absolute left-1/2 top-[31px] z-10 -translate-x-1/2 scale-[0.92]">
        {props.ethosScore !== undefined ? (
          <EthosAvatarScoreBadge
            score={props.ethosScore}
            level={props.ethosLevel}
            profileQuery={props.ethosAddress}
            profileQueryKind="address"
          />
        ) : (
          <EthosAvatarScoreForAddress address={props.ethosAddress} />
        )}
      </span>
    </div>
  )
}

function RowShell(props: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
  trailing?: ReactNode
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (props.disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={props.disabled ? -1 : 0}
      aria-disabled={props.disabled}
      onClick={props.onClick}
      onKeyDown={onKeyDown}
      aria-label={props.label}
      className="group relative flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-2.5 py-2 text-left transition-[background,border-color,transform] duration-200 motion-reduce:transition-none hover:-translate-y-px hover:border-white/10 hover:bg-white/[0.055] active:translate-y-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/70"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-0 w-px bg-brand-primary/0 transition-colors group-hover:bg-brand-primary/50" />
      {props.children}
      {props.trailing ? <div className="shrink-0">{props.trailing}</div> : null}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-colors group-hover:text-brand-primary/80" />
    </div>
  )
}

function FriendActionButton(props: {
  friendState: FriendState
  onAction?: (action: FriendAction) => void
}) {
  const { friendState, onAction } = props
  if (!onAction) return null

  if (friendState === 'pending_incoming') {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onAction('accept_request')
          }}
          className="inline-flex h-6 items-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200 transition hover:bg-emerald-400/15"
          aria-label="Accept friend request"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onAction('decline_request')
          }}
          className="inline-flex h-6 items-center rounded-full border border-zinc-500/45 bg-zinc-800/65 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-200 transition hover:border-zinc-300/45 hover:bg-zinc-700/70"
          aria-label="Decline friend request"
        >
          Decline
        </button>
      </div>
    )
  }

  if (friendState === 'pending_outgoing') {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onAction('cancel_request')
        }}
        className="inline-flex h-6 items-center rounded-full border border-amber-300/35 bg-amber-300/10 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200 transition hover:bg-amber-300/15"
        aria-label="Cancel friend request"
      >
        Sent
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onAction(friendState === 'accepted' ? 'remove_friend' : 'send_request')
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-amber-300/40 hover:text-amber-200"
      aria-label={friendState === 'accepted' ? 'Remove friend' : 'Send friend request'}
    >
      <Star className={`h-3.5 w-3.5 ${friendState === 'accepted' ? 'fill-amber-300 text-amber-300' : ''}`} />
    </button>
  )
}

function BaseAgentLogo({ agent }: { agent: BaseXmtpAgent }) {
  const toneClass: Record<BaseXmtpAgent['logoTone'], string> = {
    blue: 'border-blue-400/45 bg-blue-500/15 text-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    green: 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    violet: 'border-violet-400/45 bg-violet-500/15 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    gold: 'border-amber-300/45 bg-amber-400/15 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    cyan: 'border-cyan-300/45 bg-cyan-400/15 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    pink: 'border-pink-400/45 bg-pink-500/15 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    orange: 'border-orange-400/45 bg-orange-500/15 text-orange-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    slate: 'border-slate-300/35 bg-slate-400/12 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
  }

  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center rounded-[14px] border text-[11px] font-black uppercase tracking-[-0.04em]',
        toneClass[agent.logoTone],
      )}
      aria-hidden="true"
    >
      {agent.logoText}
    </span>
  )
}

function usePresenceHeartbeat(enabled: boolean) {
  const { address, isConnected } = useAccount()

  useEffect(() => {
    if (!enabled || !isConnected || !address) return
    let cancelled = false

    async function sendHeartbeat() {
      if (cancelled) return
      try {
        await apiFetch('/api/v1/chat/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'available' }),
        })
      } catch {
        // Presence is best-effort; the UI should not interrupt chat if it fails.
      }
    }

    void sendHeartbeat()
    const intervalId = window.setInterval(sendHeartbeat, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [address, enabled, isConnected])
}

function ConversationUserRow(props: {
  conversation: ChatConversation
  onOpen?: () => void
  friendState?: FriendState
  onFriendAction?: (address: `0x${string}`, action: FriendAction) => void
}) {
  const { conversation, onOpen, friendState = 'none', onFriendAction } = props
  const peerAddress = isAddress(conversation.peerAddress) ? conversation.peerAddress : null
  const identity = useChatIdentity(peerAddress ?? null, { fallbackName: conversation.name ?? null })
  const name = identity.displayName || conversation.name || (peerAddress ? shortAddress(peerAddress) : 'XMTP contact')

  return (
    <RowShell
      label={`Open chat with ${name}`}
      onClick={() => {
        if (peerAddress) {
          requestOpenChat({ kind: 'dm', peerAddress, nameHint: name, imageUrl: identity.avatar ?? conversation.imageUrl ?? null })
        } else {
          requestOpenChat({ kind: 'group', conversationId: conversation.id, name: conversation.name || 'Conversation' })
        }
        onOpen?.()
      }}
      trailing={peerAddress ? (
        <FriendActionButton
          friendState={friendState}
          onAction={onFriendAction ? (action) => onFriendAction(peerAddress, action) : undefined}
        />
      ) : null}
    >
      <RailAvatar
        name={name}
        imageUrl={identity.avatar ?? conversation.imageUrl ?? null}
        status="conversation"
        ethosAddress={peerAddress}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[12.5px] font-semibold text-zinc-100">{name}</div>
          {conversation.unreadCount > 0 ? (
            <span className="rounded-full bg-brand-primary px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[10.5px] leading-tight text-zinc-400">
          {identity.secondary ?? conversation.lastMessageText ?? 'Recent XMTP contact'}
        </div>
      </div>
    </RowShell>
  )
}

function PresenceUserRow(props: {
  user: AvailabilityUser
  onOpen?: () => void
  friendState?: FriendState
  onFriendAction?: (address: `0x${string}`, action: FriendAction) => void
}) {
  const { user, onOpen, friendState = 'none', onFriendAction } = props
  const identity = useChatIdentity(user.address, { fallbackName: user.displayName ?? null })
  const name = identity.displayName || shortAddress(user.address)

  return (
    <RowShell
      label={`Open chat with ${name}`}
      onClick={() => {
        requestOpenChat({ kind: 'dm', peerAddress: user.address, nameHint: name, imageUrl: user.avatarUrl ?? identity.avatar ?? null })
        onOpen?.()
      }}
      trailing={(
        <FriendActionButton
          friendState={friendState}
          onAction={onFriendAction ? (action) => onFriendAction(user.address, action) : undefined}
        />
      )}
    >
      <RailAvatar
        name={name}
        imageUrl={user.avatarUrl ?? identity.avatar ?? null}
        status={user.status}
        ethosAddress={user.address}
        ethosScore={user.ethosScore}
        ethosLevel={user.ethosLevel}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-[12.5px] font-semibold text-zinc-100">{name}</div>
        </div>
        <div className="truncate text-[10.5px] leading-tight text-zinc-400">
          {identity.secondary ?? (user.status === 'available' ? 'Available now' : 'Recently active')}
        </div>
      </div>
    </RowShell>
  )
}

function BaseAgentRow({ agent, onOpen }: { agent: BaseXmtpAgent; onOpen?: () => void }) {
  const targetLabel = agent.handle ?? agent.address ?? agent.name
  const [resolving, setResolving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(agent.address ?? null)
  const handleProfile = useQuery({
    queryKey: ['baseAgentHandleProfile', agent.handle],
    queryFn: async () => {
      if (!agent.handle) return null
      return getBasenameProfileByName(agent.handle)
    },
    enabled: Boolean(agent.handle),
    staleTime: 10 * 60_000,
  })
  const directIdentity = useChatIdentity(resolvedAddress ?? agent.address, {
    fallbackName: agent.name,
    fallbackAvatar: handleProfile.data?.avatar ?? null,
  })
  const displayName =
    directIdentity.source === 'address'
      ? agent.name
      : (directIdentity.displayName || agent.name)
  const profileAvatar = directIdentity.avatar ?? handleProfile.data?.avatar ?? null
  const xmtpReachability = useQuery({
    queryKey: ['xmtpReachability', resolvedAddress],
    queryFn: async () => {
      if (!resolvedAddress) return null
      return canMessageAddressOnCurrentEnv(resolvedAddress)
    },
    enabled: Boolean(resolvedAddress),
    staleTime: 5 * 60_000,
  })
  const isXmtpReachable = xmtpReachability.data === true
  const addressLabel = resolvedAddress ? shortAddress(resolvedAddress) : targetLabel
  const subtitle = resolving
    ? 'Resolving XMTP address…'
    : failed
      ? `Could not resolve ${targetLabel}`
      : xmtpReachability.isLoading
        ? `Checking XMTP reachability · ${addressLabel}`
        : `${agent.description} · ${addressLabel}`

  useEffect(() => {
    if (resolvedAddress || !agent.handle) return
    let cancelled = false
    resolveBasenameAddress(agent.handle)
      .then((address) => {
        if (cancelled) return
        setResolvedAddress(resolveAgentAddress(address))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [agent.handle, resolvedAddress])

  async function openAgentChat() {
    if (resolving) return
    setResolving(true)
    setFailed(false)
    try {
      const nextAddress = resolvedAddress ?? agent.address ?? (
        agent.handle
          ? resolveAgentAddress(await resolveBasenameAddress(agent.handle))
          : null
      )
      if (!nextAddress) {
        setFailed(true)
        return
      }
      setResolvedAddress(nextAddress)
      requestOpenChat({
        kind: 'dm',
        peerAddress: nextAddress,
        nameHint: displayName,
        imageUrl: profileAvatar,
      })
      onOpen?.()
    } finally {
      setResolving(false)
    }
  }

  if (xmtpReachability.data === false) return null

  return (
    <RowShell
      label={`Open chat with ${displayName}`}
      disabled={resolving || (!agent.address && !agent.handle)}
      onClick={() => void openAgentChat()}
    >
      <RailAvatar
        name={agent.name}
        imageUrl={profileAvatar}
        icon={<BaseAgentLogo agent={agent} />}
        status={isXmtpReachable ? 'available' : undefined}
        ethosAddress={resolvedAddress}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[12.5px] font-semibold text-zinc-100">{displayName}</div>
          <span className="shrink-0 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-blue-200">
            Base
          </span>
        </div>
        <div className="truncate text-[10.5px] leading-tight text-zinc-400">
          {subtitle}
        </div>
      </div>
    </RowShell>
  )
}

function CreatorAgentRow({ agent, onOpen }: { agent: AgentRow; onOpen?: () => void }) {
  const canonical = isCanonical4626Agent(agent)
  const identityAddress = canonical
    ? CANONICAL_4626_MAIN_ACCOUNT
    : agent.cswAddress && isAddress(agent.cswAddress)
      ? agent.cswAddress
      : agent.creatorAddress
  const scoreAddress = canonical ? CANONICAL_4626_MAIN_ACCOUNT : identityAddress
  const creatorIdentity = useChatIdentity(identityAddress)
  const agentIdentity = useChatIdentity(agent.xmtpAgentAddress)
  const agentAddress = isAddress(agent.xmtpAgentAddress) ? agent.xmtpAgentAddress : null
  const identityLabel = creatorIdentity.source !== 'address'
    ? creatorIdentity.displayName
    : agentIdentity.source !== 'address'
      ? agentIdentity.displayName
      : shortAddress(identityAddress)
  const name = canonical ? 'agent 4626' : `${identityLabel} agent`
  const avatar = creatorIdentity.avatar ?? agentIdentity.avatar ?? null
  const xmtpReachability = useQuery({
    queryKey: ['xmtpReachability', agentAddress],
    queryFn: async () => {
      if (!agentAddress) return null
      return canMessageAddressOnCurrentEnv(agentAddress)
    },
    enabled: Boolean(agentAddress),
    staleTime: 5 * 60_000,
  })
  const isXmtpReachable = xmtpReachability.data === true
  const addressLabel = agentAddress ? shortAddress(agentAddress) : 'missing address'
  const subtitle = xmtpReachability.isLoading
      ? `Checking XMTP reachability · ${addressLabel}`
      : canonical
        ? `Canonical ERC-8004 agent · ${creatorIdentity.secondary ?? shortAddress(CANONICAL_4626_MAIN_ACCOUNT)}`
        : `${agent.agentType === 'csw' ? 'Smart-wallet agent' : 'Creator agent'} · ${agentIdentity.secondary ?? shortAddress(agent.xmtpAgentAddress)}`

  if (xmtpReachability.data === false) return null

  return (
    <RowShell
      label={`Open chat with ${name}`}
      disabled={!agentAddress}
      onClick={() => {
        if (agentAddress) {
          requestOpenChat({ kind: 'dm', peerAddress: agentAddress, nameHint: name, imageUrl: avatar })
          onOpen?.()
        }
      }}
    >
      <RailAvatar
        name={name}
        imageUrl={avatar}
        icon={<Bot className="h-4 w-4 text-brand-primary" />}
        status={isXmtpReachable ? 'available' : undefined}
        ethosAddress={scoreAddress}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[12.5px] font-semibold text-zinc-100">{name}</div>
          <span className="shrink-0 rounded-full border border-violet-300/30 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-violet-100">
            4626
          </span>
        </div>
        <div className="truncate text-[10.5px] leading-tight text-zinc-400">
          {subtitle}
        </div>
      </div>
    </RowShell>
  )
}

function RailSkeletonRows() {
  return (
    <div className="space-y-1.5 px-1 py-1" role="status" aria-live="polite" aria-label="Loading chat availability">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
          <div className="h-9 w-9 rounded-2xl bg-white/[0.07] motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-white/[0.07] motion-safe:animate-pulse" />
            <div className="h-2.5 w-1/2 rounded-full bg-white/[0.045] motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function RailEmptyState(props: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="mx-1 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-zinc-500">
        {props.icon}
      </div>
      <div className="mt-3 text-sm font-medium text-zinc-300">{props.title}</div>
      <p className="mx-auto mt-1 max-w-[220px] text-xs leading-relaxed text-zinc-600">{props.body}</p>
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  )
}

function friendActionSuccessMessage(action: FriendAction): string {
  switch (action) {
    case 'send_request':
      return 'Friend request sent.'
    case 'accept_request':
      return 'Friend request accepted.'
    case 'decline_request':
      return 'Friend request declined.'
    case 'cancel_request':
      return 'Friend request canceled.'
    case 'remove_friend':
      return 'Removed from friends.'
  }
}

function friendActionErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'friend_action_failed'
  switch (raw) {
    case 'already_friends':
      return 'You are already friends.'
    case 'request_already_sent':
      return 'You already sent a request.'
    case 'incoming_request_exists':
      return 'They already sent you a request. Accept it instead.'
    case 'request_not_found':
      return 'Friend request no longer exists.'
    default:
      return 'Could not update friend request right now.'
  }
}

export function ChatAvailabilityRail(props: { onExpandedChange?: (expanded: boolean) => void } = {}) {
  const { onExpandedChange } = props
  const { status, connect, conversations } = useXmtp()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'groups'>('all')
  const [presenceEnabled, setPresenceEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(PRESENCE_OPT_IN_KEY) === '1'
  })

  usePresenceHeartbeat(presenceEnabled)

  useEffect(() => {
    onExpandedChange?.(expanded)
  }, [expanded, onExpandedChange])

  useEffect(() => {
    return () => onExpandedChange?.(false)
  }, [onExpandedChange])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleToggleRequest = () => {
      setExpanded((current) => {
        const next = !current
        if (next && status === 'idle') void connect('user')
        return next
      })
    }

    window.addEventListener(CHAT_TOGGLE_REQUEST_EVENT, handleToggleRequest)
    return () => window.removeEventListener(CHAT_TOGGLE_REQUEST_EVENT, handleToggleRequest)
  }, [connect, status])

  const availability = useQuery({
    queryKey: ['chatAvailability'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/chat/availability?limit=40')
      if (!res.ok) throw new Error('Failed to load availability')
      const json = (await res.json()) as { success: boolean; data?: AvailabilityResponse }
      return json.data ?? { users: [], generatedAt: new Date().toISOString() }
    },
    staleTime: 30_000,
    enabled: expanded,
  })

  const agents = useQuery({
    queryKey: ['chatAgents'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/chat/agents?limit=30')
      if (!res.ok) throw new Error('Failed to load agents')
      const json = (await res.json()) as { success: boolean; data?: AgentsResponse }
      return json.data?.agents ?? []
    },
    staleTime: 60_000,
    enabled: expanded,
  })

  const friendSnapshot = useQuery({
    queryKey: ['chatFriends'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/chat/friends')
      if (!res.ok) throw new Error('Failed to load friends')
      const json = (await res.json()) as { success: boolean; data?: FriendsResponse }
      return json.data ?? { friends: [], incoming: [], outgoing: [] }
    },
    staleTime: 15_000,
    enabled: expanded,
  })

  const friendActionMutation = useMutation({
    mutationFn: async (variables: { targetAddress: `0x${string}`; action: FriendAction }) => {
      const res = await apiFetch('/api/v1/chat/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAddress: variables.targetAddress,
          action: variables.action,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        const error = typeof json?.error === 'string' ? json.error : 'friend_action_failed'
        throw new Error(error)
      }
      return json
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['chatFriends'] })
      toast.success(friendActionSuccessMessage(variables.action))
    },
    onError: (error) => {
      toast.error(friendActionErrorMessage(error))
    },
  })

  const visibleConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter((conversation) => conversation.type === 'dm')
      .filter((conversation) =>
        !q ||
        (conversation.name ?? '').toLowerCase().includes(q) ||
        (conversation.peerAddress ?? '').toLowerCase().includes(q) ||
        (conversation.lastMessageText ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.unreadCount - a.unreadCount || (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
      .slice(0, 12)
  }, [conversations, query])

  const visibleGroupConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter((conversation) => conversation.type === 'group')
      .filter((conversation) =>
        !q ||
        (conversation.name ?? '').toLowerCase().includes(q) ||
        (conversation.lastMessageText ?? '').toLowerCase().includes(q) ||
        conversation.id.toLowerCase().includes(q),
      )
      .sort((a, b) => b.unreadCount - a.unreadCount || (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
      .slice(0, 16)
  }, [conversations, query])

  const visiblePresenceUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (availability.data?.users ?? [])
      .filter((user) => !q || user.address.toLowerCase().includes(q) || (user.displayName ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        const statusDelta = (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1)
        if (statusDelta !== 0) return statusDelta
        return scoreRank(b.ethosScore) - scoreRank(a.ethosScore)
      })
      .slice(0, 20)
  }, [availability.data?.users, query])

  const visibleAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const dedupedByDisplayAccount = new Map<string, AgentRow>()
    for (const agent of (agents.data ?? [])
      .filter((agent) => !q || agent.creatorAddress.toLowerCase().includes(q) || agent.xmtpAgentAddress.toLowerCase().includes(q))
      .sort((a, b) => Number(isCanonical4626Agent(b)) - Number(isCanonical4626Agent(a)))
    ) {
      const key = getCreatorAgentDisplayGroupKey(agent)
      dedupedByDisplayAccount.set(key, pickPreferredCreatorAgentRow(dedupedByDisplayAccount.get(key), agent))
    }
    return [...dedupedByDisplayAccount.values()].slice(0, 20)
  }, [agents.data, query])

  const visibleBaseAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return BASE_XMTP_AGENTS.filter((agent) => {
      if (!q) return true
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.category.toLowerCase().includes(q) ||
        (agent.handle ?? '').toLowerCase().includes(q) ||
        (agent.address ?? '').toLowerCase().includes(q)
      )
    })
  }, [query])

  function setPresenceOptIn(next: boolean) {
    setPresenceEnabled(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(PRESENCE_OPT_IN_KEY, next ? '1' : '0')
  }

  function getFriendState(address: string | null | undefined): FriendState {
    if (!isAddress(address)) return 'none'
    const normalized = address.toLowerCase()
    const outgoing = friendSnapshot.data?.outgoing.some((item) => item.address.toLowerCase() === normalized)
    if (outgoing) return 'pending_outgoing'
    const incoming = friendSnapshot.data?.incoming.some((item) => item.address.toLowerCase() === normalized)
    if (incoming) return 'pending_incoming'
    const friend = friendSnapshot.data?.friends.some((item) => item.address.toLowerCase() === normalized)
    if (friend) return 'accepted'
    return 'none'
  }

  function runFriendAction(address: `0x${string}`, action: FriendAction) {
    void friendActionMutation.mutateAsync({ targetAddress: address, action })
  }

  function collapseAfterOpenIfReady() {
    if (status === 'connected') {
      setExpanded(false)
    }
  }

  if (!expanded) {
    const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
    return (
      <aside className="fixed left-4 top-24 z-60 hidden md:block">
        <button
          type="button"
          onClick={() => {
            setExpanded(true)
            if (status === 'idle') void connect('user')
          }}
          className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/65 text-zinc-300 shadow-[0_18px_46px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-[border-color,background,transform] duration-200 hover:-translate-y-px hover:border-brand-primary/35 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
          aria-label="Open XMTP chat"
        >
          <span aria-hidden="true" className="absolute inset-x-2 top-0 h-px bg-linear-to-r from-transparent via-white/18 to-transparent" />
          <img
            src="/brand/xmtp-x-mark-white.svg"
            alt=""
            className="h-5 w-5 select-none object-contain opacity-90 transition-opacity group-hover:opacity-100"
            draggable={false}
          />
          {totalUnread > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full border border-black bg-brand-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          ) : null}
        </button>
      </aside>
    )
  }

  const hasUsers = visibleConversations.length > 0 || visiblePresenceUsers.length > 0
  const incomingRequests = friendSnapshot.data?.incoming ?? []
  const outgoingRequests = friendSnapshot.data?.outgoing ?? []
  const friendConversations = visibleConversations.filter(
    (conversation) => getFriendState(conversation.peerAddress) === 'accepted',
  )
  const friendConversationAddressSet = new Set(
    friendConversations
      .map((conversation) => conversation.peerAddress?.toLowerCase())
      .filter((address): address is string => Boolean(address)),
  )
  const friendPresenceUsers = visiblePresenceUsers.filter(
    (user) =>
      getFriendState(user.address) === 'accepted' &&
      !friendConversationAddressSet.has(user.address.toLowerCase()),
  )
  const nonFriendConversations = visibleConversations.filter(
    (conversation) => getFriendState(conversation.peerAddress) !== 'accepted',
  )
  const nonFriendPresenceUsers = visiblePresenceUsers.filter(
    (user) => getFriendState(user.address) !== 'accepted',
  )
  const incomingRequestUsers = incomingRequests
    .map((request) => {
      const fromPresence = (availability.data?.users ?? []).find(
        (candidate) => candidate.address.toLowerCase() === request.address.toLowerCase(),
      )
      if (fromPresence) return fromPresence
      return {
        address: request.address,
        status: 'recent',
        lastSeenAt: null,
      } as AvailabilityUser
    })
    .filter((user) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return user.address.toLowerCase().includes(q) || String(user.displayName ?? '').toLowerCase().includes(q)
    })
  const outgoingRequestUsers = outgoingRequests
    .map((request) => {
      const fromPresence = (availability.data?.users ?? []).find(
        (candidate) => candidate.address.toLowerCase() === request.address.toLowerCase(),
      )
      if (fromPresence) return fromPresence
      return {
        address: request.address,
        status: 'recent',
        lastSeenAt: null,
      } as AvailabilityUser
    })
    .filter((user) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return user.address.toLowerCase().includes(q) || String(user.displayName ?? '').toLowerCase().includes(q)
    })
  const availabilityError = availability.isError
  const agentsError = agents.isError
  const unreadDmConversations = visibleConversations.filter((conversation) => conversation.unreadCount > 0)
  const unreadGroupConversations = visibleGroupConversations.filter((conversation) => conversation.unreadCount > 0)
  const showGroupsTab = filterTab === 'groups'
  const showUnreadTab = filterTab === 'unread'
  const showAllTab = filterTab === 'all'
  const connectedLabel =
    status === 'connected'
      ? 'XMTP connected'
      : status === 'connecting' || status === 'signing'
        ? 'Connecting XMTP'
        : 'XMTP idle'

  return (
    <aside className={cn('fixed bottom-24 left-4 top-24 z-60 hidden overflow-hidden rounded-[28px] border border-white/10 bg-black/72 shadow-[0_30px_90px_-42px_rgba(0,0,0,0.95)] backdrop-blur-2xl md:flex md:flex-col motion-safe:animate-scale-in', RAIL_WIDTH_CLASS)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_42%_at_84%_0%,rgb(var(--brand-primary)/0.16),transparent_68%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/22 to-transparent" />

      <div className="relative border-b border-white/8 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <div className="text-[29px] leading-none font-bold tracking-tight text-zinc-100">Chats</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
              <span className={cn('h-1.5 w-1.5 rounded-full', status === 'connected' ? 'bg-emerald-400' : 'bg-zinc-600')} />
              {connectedLabel}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                requestNewDm()
                setExpanded(false)
              }}
              className="rounded-full bg-white/[0.055] p-2 text-zinc-400 transition hover:bg-white/[0.11] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
              aria-label="Start new direct message"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full bg-white/[0.055] p-2 text-zinc-400 transition hover:bg-white/[0.11] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
              aria-label="Collapse availability rail"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 transition-colors focus-within:border-brand-primary/45 focus-within:bg-white/[0.09]">
          <span className="sr-only">Search people, vaults, and agents</span>
          <Search className="h-3.5 w-3.5 text-zinc-500 transition-colors" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </label>
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'unread' as const, label: 'Unread' },
            { id: 'groups' as const, label: 'Groups' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilterTab(item.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
                filterTab === item.id
                  ? 'border-[#2f80ed] bg-[#2374e1] text-white shadow-[0_0_0_1px_rgba(47,128,237,0.45)]'
                  : 'border-white/8 bg-white/[0.055] text-zinc-300 hover:border-white/14 hover:bg-white/[0.11]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPresenceOptIn(!presenceEnabled)}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-[12px] font-medium transition ${
            presenceEnabled
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-white/8 bg-white/[0.035] text-zinc-500 hover:border-white/14 hover:bg-white/[0.06] hover:text-zinc-300'
          }`}
        >
          <Wifi className="h-3.5 w-3.5" />
          {presenceEnabled ? 'Status: Available' : 'Set status: Available'}
        </button>
      </div>

      <div className="relative min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5 [scrollbar-gutter:stable]">
        {showGroupsTab && visibleGroupConversations.length > 0 ? (
          <RailSection label="Groups" hint={`${visibleGroupConversations.length}`}>
            {visibleGroupConversations.map((conversation) => (
              <ConversationUserRow
                key={conversation.id}
                conversation={conversation}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {showGroupsTab && visibleGroupConversations.length === 0 ? (
          <RailEmptyState
            icon={<Users className="h-4 w-4" />}
            title={query ? 'No matching groups' : 'No group chats yet'}
            body={query ? 'Try a different search query.' : 'Group conversations will appear here when joined.'}
          />
        ) : null}
        {(showAllTab || showUnreadTab) && availability.isLoading && conversations.length === 0 ? <RailSkeletonRows /> : null}
        {(showAllTab || showUnreadTab) && availabilityError ? (
          <RailEmptyState
            icon={<AlertCircle className="h-4 w-4" />}
            title="Availability unavailable"
            body="Recent chats still work. Peer presence will return when the directory API responds."
          />
        ) : null}
        {showAllTab && (visibleBaseAgents.length > 0 || visibleAgents.length > 0 || agents.isLoading || agentsError) ? (
          <RailSection
            label="Agents"
            hint={`${visibleBaseAgents.length + visibleAgents.length}${agents.isLoading ? '+' : ''}`}
          >
            {visibleBaseAgents.map((agent) => (
              <BaseAgentRow key={agent.id} agent={agent} onOpen={collapseAfterOpenIfReady} />
            ))}
            {!agents.isLoading && !agentsError
              ? visibleAgents.map((agent) => (
                  <CreatorAgentRow key={agent.creatorAddress} agent={agent} onOpen={collapseAfterOpenIfReady} />
                ))
              : null}
            {agents.isLoading ? <RailSkeletonRows /> : null}
            {agentsError ? (
              <div className="mx-1 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500">
                4626 agents are unavailable right now. Base agents still work.
              </div>
            ) : null}
          </RailSection>
        ) : null}
        {showAllTab && !agents.isLoading && !agentsError && visibleAgents.length === 0 && visibleBaseAgents.length === 0 ? (
          <RailEmptyState
            icon={<Sparkles className="h-4 w-4" />}
            title={query ? 'No matching agents' : 'No agents listed yet'}
            body={
              query
                ? 'Clear search or try an agent name, handle, or wallet address.'
                : 'Base and 4626 agents will appear here once they are listed.'
            }
          />
        ) : null}
        {showAllTab && nonFriendConversations.length > 0 ? (
          <RailSection
            label="Recent Conversations"
            hint={`${nonFriendConversations.length}`}
          >
            {nonFriendConversations.map((conversation) => (
              <ConversationUserRow
                key={conversation.id}
                conversation={conversation}
                friendState={getFriendState(conversation.peerAddress)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {showUnreadTab && unreadDmConversations.length > 0 ? (
          <RailSection
            label="Unread Conversations"
            hint={`${unreadDmConversations.length}`}
          >
            {unreadDmConversations.map((conversation) => (
              <ConversationUserRow
                key={conversation.id}
                conversation={conversation}
                friendState={getFriendState(conversation.peerAddress)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {(showAllTab || showUnreadTab) && incomingRequestUsers.length > 0 ? (
          <RailSection label="Friend Requests" hint={`${incomingRequestUsers.length} incoming`}>
            {incomingRequestUsers.map((user) => (
              <PresenceUserRow
                key={`incoming-${user.address}`}
                user={user}
                friendState={getFriendState(user.address)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {showAllTab && outgoingRequestUsers.length > 0 ? (
          <RailSection label="Pending Sent" hint={`${outgoingRequestUsers.length}`}>
            {outgoingRequestUsers.map((user) => (
              <PresenceUserRow
                key={`outgoing-${user.address}`}
                user={user}
                friendState={getFriendState(user.address)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {showAllTab && (friendConversations.length > 0 || friendPresenceUsers.length > 0) ? (
          <RailSection
            label="Friends"
            hint={`${friendConversations.length + friendPresenceUsers.length}`}
          >
            {friendConversations.map((conversation) => (
              <ConversationUserRow
                key={conversation.id}
                conversation={conversation}
                friendState={getFriendState(conversation.peerAddress)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
            {friendPresenceUsers.map((user) => (
              <PresenceUserRow
                key={user.address}
                user={user}
                friendState={getFriendState(user.address)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {showUnreadTab && unreadGroupConversations.length > 0 ? (
          <RailSection label="Unread Groups" hint={`${unreadGroupConversations.length}`}>
            {unreadGroupConversations.map((conversation) => (
              <ConversationUserRow
                key={conversation.id}
                conversation={conversation}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {showAllTab && nonFriendPresenceUsers.length > 0 ? (
          <RailSection label="Online Users" hint="ETHOS ranked">
            {nonFriendPresenceUsers.map((user) => (
              <PresenceUserRow
                key={user.address}
                user={user}
                friendState={getFriendState(user.address)}
                onFriendAction={runFriendAction}
                onOpen={collapseAfterOpenIfReady}
              />
            ))}
          </RailSection>
        ) : null}
        {(showAllTab || showUnreadTab) && !availability.isLoading && !availabilityError && !hasUsers ? (
          <RailEmptyState
            icon={<Users className="h-4 w-4" />}
            title={query ? 'No matching people' : 'No one visible yet'}
            body={query ? 'Try a wallet address, Basename, or clear search.' : 'Opt into availability or start a chat. Recent XMTP contacts will appear here first.'}
            action={!presenceEnabled ? (
              <button
                type="button"
                onClick={() => setPresenceOptIn(true)}
                className="rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-brand-primary/15"
              >
                Go available
              </button>
            ) : null}
          />
        ) : null}
        {showUnreadTab && unreadDmConversations.length === 0 && unreadGroupConversations.length === 0 && incomingRequestUsers.length === 0 ? (
          <RailEmptyState
            icon={<Users className="h-4 w-4" />}
            title="No unread chats"
            body="You’re all caught up."
          />
        ) : null}
      </div>
    </aside>
  )
}
