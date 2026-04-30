import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Hash, MessageSquare, PanelLeftClose, PanelLeftOpen, Search, Users, Wifi } from 'lucide-react'
import { useAccount } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import { requestOpenChat } from '@/lib/chat/openChat'
import { useIdentity } from '@/hooks/useIdentity'
import { useXmtp, type ChatConversation } from '@/lib/xmtp/provider'

type AgentRow = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType?: 'eoa' | 'csw'
  listedPublicly: boolean
  createdAt: string
}

type AvailabilityUser = {
  address: `0x${string}`
  displayName?: string | null
  avatarUrl?: string | null
  ethosScore?: number | null
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

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
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

function ConversationUserRow({ conversation }: { conversation: ChatConversation }) {
  const peerAddress = isAddress(conversation.peerAddress) ? conversation.peerAddress : null
  const identity = useIdentity(peerAddress ?? undefined)
  const name = identity.displayName || conversation.name || (peerAddress ? shortAddress(peerAddress) : 'XMTP contact')

  return (
    <button
      type="button"
      onClick={() => {
        if (peerAddress) {
          requestOpenChat({ kind: 'dm', peerAddress, nameHint: name, imageUrl: identity.avatar ?? conversation.imageUrl ?? null })
        } else {
          requestOpenChat({ kind: 'group', conversationId: conversation.id, name: conversation.name || 'Conversation' })
        }
      }}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
    >
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/8">
        {identity.avatar || conversation.imageUrl ? (
          <img src={identity.avatar ?? conversation.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-zinc-400">
            {name.slice(0, 2)}
          </div>
        )}
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-black bg-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-200">{name}</div>
        <div className="truncate text-[10px] text-zinc-500">
          {conversation.unreadCount > 0 ? `${conversation.unreadCount} unread` : identity.secondary ?? 'Recent XMTP contact'}
        </div>
      </div>
      <MessageSquare className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-brand-primary" />
    </button>
  )
}

function PresenceUserRow({ user }: { user: AvailabilityUser }) {
  const identity = useIdentity(user.address)
  const name = user.displayName || identity.displayName || shortAddress(user.address)

  return (
    <button
      type="button"
      onClick={() => requestOpenChat({ kind: 'dm', peerAddress: user.address, nameHint: name, imageUrl: user.avatarUrl ?? identity.avatar ?? null })}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
    >
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/8">
        {user.avatarUrl || identity.avatar ? (
          <img src={user.avatarUrl ?? identity.avatar ?? undefined} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-zinc-400">
            {name.slice(0, 2)}
          </div>
        )}
        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-black ${user.status === 'available' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-200">{name}</div>
        <div className="truncate text-[10px] text-zinc-500">
          {typeof user.ethosScore === 'number' ? `ETHOS ${user.ethosScore}` : identity.secondary ?? user.status}
        </div>
      </div>
      <MessageSquare className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-brand-primary" />
    </button>
  )
}

function AgentRow({ agent }: { agent: AgentRow }) {
  const creatorIdentity = useIdentity(agent.creatorAddress)
  const agentIdentity = useIdentity(agent.xmtpAgentAddress)
  const agentAddress = isAddress(agent.xmtpAgentAddress) ? agent.xmtpAgentAddress : null
  const name = `${creatorIdentity.displayName || shortAddress(agent.creatorAddress)} agent`

  return (
    <button
      type="button"
      disabled={!agentAddress}
      onClick={() => {
        if (agentAddress) requestOpenChat({ kind: 'dm', peerAddress: agentAddress, nameHint: name, imageUrl: creatorIdentity.avatar ?? null })
      }}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-200">{name}</div>
        <div className="truncate text-[10px] text-zinc-500">
          AI Agent · {agentIdentity.secondary ?? shortAddress(agent.xmtpAgentAddress)}
        </div>
      </div>
      <MessageSquare className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-brand-primary" />
    </button>
  )
}

export function ChatAvailabilityRail() {
  const { status, connect, conversations } = useXmtp()
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'users' | 'vaults' | 'agents'>('users')
  const [query, setQuery] = useState('')
  const [presenceEnabled, setPresenceEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(PRESENCE_OPT_IN_KEY) === '1'
  })

  usePresenceHeartbeat(presenceEnabled)

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

  const visibleConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter((conversation) => conversation.type === 'dm')
      .filter((conversation) => !q || conversation.name.toLowerCase().includes(q) || (conversation.peerAddress ?? '').toLowerCase().includes(q))
      .slice(0, 12)
  }, [conversations, query])

  const visiblePresenceUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (availability.data?.users ?? [])
      .filter((user) => !q || user.address.toLowerCase().includes(q) || (user.displayName ?? '').toLowerCase().includes(q))
      .slice(0, 20)
  }, [availability.data?.users, query])

  const visibleAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (agents.data ?? [])
      .filter((agent) => !q || agent.creatorAddress.toLowerCase().includes(q) || agent.xmtpAgentAddress.toLowerCase().includes(q))
      .slice(0, 20)
  }, [agents.data, query])

  function setPresenceOptIn(next: boolean) {
    setPresenceEnabled(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(PRESENCE_OPT_IN_KEY, next ? '1' : '0')
  }

  if (!expanded) {
    return (
      <aside className="fixed left-3 top-24 z-60 hidden md:block">
        <button
          type="button"
          onClick={() => {
            setExpanded(true)
            if (status === 'idle') void connect()
          }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/55 text-zinc-300 shadow-2xl shadow-black/35 backdrop-blur-xl transition hover:border-brand-primary/35 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
          aria-label="Open available chat users"
        >
          <Users className="h-5 w-5" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="fixed bottom-24 left-3 top-24 z-60 hidden w-[304px] overflow-hidden rounded-3xl border border-white/10 bg-black/72 shadow-2xl shadow-black/40 backdrop-blur-xl md:flex md:flex-col">
      <div className="border-b border-white/8 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Available to Chat</div>
            <div className="mt-0.5 text-xs text-zinc-300">
              {status === 'connected' ? 'XMTP connected' : 'XMTP ready'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/6 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
            aria-label="Collapse availability rail"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-zinc-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, vaults, agents"
            className="min-w-0 flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
        <button
          type="button"
          onClick={() => setPresenceOptIn(!presenceEnabled)}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-medium transition ${
            presenceEnabled
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-white/8 bg-white/4 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Wifi className="h-3.5 w-3.5" />
          {presenceEnabled ? 'Visible as available' : 'Go available'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 border-b border-white/8 p-2">
        {[
          { id: 'users' as const, label: 'Users', icon: Users },
          { id: 'vaults' as const, label: 'Vaults', icon: Hash },
          { id: 'agents' as const, label: 'Agents', icon: Bot },
        ].map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
                tab === item.id ? 'bg-brand-primary/14 text-brand-primary' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
        {tab === 'users' ? (
          <>
            {visibleConversations.length > 0 ? (
              <section>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Conversations
                </div>
                {visibleConversations.map((conversation) => (
                  <ConversationUserRow key={conversation.id} conversation={conversation} />
                ))}
              </section>
            ) : null}
            {visiblePresenceUsers.length > 0 ? (
              <section>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Available by ETHOS
                </div>
                {visiblePresenceUsers.map((user) => (
                  <PresenceUserRow key={user.address} user={user} />
                ))}
              </section>
            ) : null}
            {visibleConversations.length === 0 && visiblePresenceUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-zinc-500">
                No available users yet. Recent XMTP conversations will appear here first.
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'vaults' ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-zinc-500">
            Vault chats appear here after a vault creates its XMTP group and policy.
          </div>
        ) : null}

        {tab === 'agents' ? (
          <>
            {visibleAgents.length > 0 ? visibleAgents.map((agent) => <AgentRow key={agent.creatorAddress} agent={agent} />) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-zinc-500">
                No creator agents listed yet.
              </div>
            )}
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="absolute -right-3 top-5 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black text-zinc-500 transition hover:text-zinc-200"
        aria-label="Collapse chat rail"
      >
        <PanelLeftOpen className="h-3.5 w-3.5 rotate-180" />
      </button>
    </aside>
  )
}
