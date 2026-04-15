/**
 * AgentDirectory — browse and message creator XMTP agents.
 *
 * Fetches from /api/v1/agents/creators and displays a grid of creator agents
 * with identity resolution (Base Name / Lens / truncated address).
 */

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Bot, ExternalLink, Users } from 'lucide-react'
import { apiFetch } from '@/lib/api/apiBase'
import { useIdentity } from '@/hooks/useIdentity'
import { useXmtp } from '@/lib/xmtp/provider'
import { PageMeta, META } from '@/components/seo/PageMeta'
import { AgentVerificationCard } from '@/components/agents/AgentVerificationCard'
import { LoadingInline } from '@/components/ui/LoadingState'

type AgentRow = {
  creatorAddress: string
  xmtpAgentAddress: string
  listedPublicly: boolean
  createdAt: string
}

type AgentsResponse = {
  count: number
  agents: AgentRow[]
  nextCursor: string | null
}

function AgentCard({
  agent,
  onMessage,
}: {
  agent: AgentRow
  onMessage: (address: string) => void
}) {
  const creatorIdentity = useIdentity(agent.creatorAddress)
  const agentIdentity = useIdentity(agent.xmtpAgentAddress)

  return (
    <div className="group relative rounded-2xl border border-white/5 bg-white/2 hover:bg-white/4 transition-colors overflow-hidden">
      <div className="p-5 space-y-4">
        {/* Creator identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {creatorIdentity.avatar ? (
              <img src={creatorIdentity.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-zinc-400 uppercase">
                {creatorIdentity.displayName.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-200 truncate">{creatorIdentity.displayName}</div>
            <div className="text-[10px] text-zinc-500 truncate">
              {creatorIdentity.secondary ?? `${agent.creatorAddress.slice(0, 6)}…${agent.creatorAddress.slice(-4)}`}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {creatorIdentity.lensHandle ? (
                <span className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-cyan-200">
                  Lens @{creatorIdentity.lensHandle}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {!creatorIdentity.secondary ? (
          <div className="app-meta-value text-zinc-600 truncate">
            {agent.creatorAddress.slice(0, 6)}…{agent.creatorAddress.slice(-4)}
          </div>
        ) : null}

        {/* Agent info */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <Bot className="w-3 h-3 text-brand-primary/60" />
          <span className="truncate">
            Agent: <span>{agentIdentity.displayName}</span>
            {agentIdentity.secondary ? <span className="ml-1 text-zinc-600">({agentIdentity.secondary})</span> : null}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMessage(agent.xmtpAgentAddress)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-medium py-2.5 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Message
          </button>
          <a
            href={`https://basescan.org/address/${agent.creatorAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/5 hover:border-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="View on Basescan"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}

export function AgentDirectory() {
  const { status, connect, startDm } = useXmtp()
  const [messagingAddress, setMessagingAddress] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['agentDirectory'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/agents/creators?limit=50&listed=true')
      if (!res.ok) throw new Error('Failed to load agents')
      const json = (await res.json()) as { success: boolean; data?: AgentsResponse; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed')
      return json.data!
    },
    staleTime: 60_000,
  })

  const handleMessage = useCallback(
    async (agentAddress: string) => {
      if (status !== 'connected') {
        setMessagingAddress(agentAddress)
        await connect()
        return
      }
      setMessagingAddress(null)
      const dmResult = await startDm(agentAddress as `0x${string}`)
      if (dmResult.ok) {
        // The ChatWidget will auto-show the new conversation
      }
    },
    [status, connect, startDm],
  )

  // After connecting, start the DM that was pending
  if (status === 'connected' && messagingAddress) {
    void handleMessage(messagingAddress)
  }

  const agents = data?.agents ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <PageMeta title={META.agents.title} description={META.agents.description} canonicalPath="/agents" />
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-brand-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
              Creator Agents
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Message creator agents via XMTP
            </p>
          </div>
          <Link
            to="/agents/register"
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100"
          >
            <Bot className="h-3.5 w-3.5" />
            Register Agent
          </Link>
        </div>

        {status !== 'connected' && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-900/50 border border-white/5 px-4 py-3">
            <MessageSquare className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">
              Connect to XMTP to message agents
            </span>
            <button
              type="button"
              onClick={connect}
              className="ml-auto px-3 py-1.5 rounded-lg bg-brand-primary/20 text-brand-primary text-xs font-medium hover:bg-brand-primary/30 transition-colors"
            >
              Enable Chat
            </button>
          </div>
        )}
      </div>

      <div className="mb-10">
        <AgentVerificationCard />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <LoadingInline intent="page" labelOverride="Loading..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-20 text-sm text-zinc-500">
          Could not load agents. Try again later.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && agents.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <Bot className="w-10 h-10 text-zinc-700 mx-auto" />
          <div className="text-sm text-zinc-500">No creator agents listed yet.</div>
        </div>
      )}

      {/* Grid */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.creatorAddress} agent={agent} onMessage={handleMessage} />
          ))}
        </div>
      )}
    </div>
  )
}
