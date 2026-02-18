import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CheckCircle2, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { getAddress, parseAbiItem, parseEventLogs, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { META, PageMeta } from '@/components/seo/PageMeta'

const DEFAULT_ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'

const ERC8004_IDENTITY_REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ERC8004_REGISTERED_EVENT = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
)

function getReadableError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? 'Registration failed.')
  const lower = msg.toLowerCase()
  if (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('action_rejected') ||
    lower.includes('user denied') ||
    lower.includes('user cancelled')
  ) {
    return 'Transaction cancelled in wallet.'
  }
  if (lower.includes('insufficient funds')) {
    return 'Insufficient funds for gas. Add Base ETH and retry.'
  }
  return msg
}

export function AgentRegister() {
  const [agentUri, setAgentUri] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null)

  const { address: connectedAddress, chainId, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: base.id }) ?? usePublicClient()
  const { switchChainAsync } = useSwitchChain()

  const registryAddress = useMemo(() => {
    const fromEnv = String(import.meta.env.VITE_ERC8004_AGENT_REGISTRY ?? '').trim()
    return getAddress((fromEnv || DEFAULT_ERC8004_IDENTITY_REGISTRY) as Address)
  }, [])

  const canSubmit = Boolean(
    !busy && isConnected && connectedAddress && walletClient && publicClient && agentUri.trim(),
  )

  const ensureBaseChain = useCallback(async () => {
    if (chainId === base.id) return
    if (!switchChainAsync) throw new Error('Switch to Base in your wallet to continue.')
    await switchChainAsync({ chainId: base.id })
  }, [chainId, switchChainAsync])

  const onRegister = useCallback(async () => {
    if (!canSubmit) return
    if (!connectedAddress || !walletClient || !publicClient) return
    const uri = agentUri.trim()
    if (!uri) return

    setBusy(true)
    setError(null)
    setSuccess(null)
    setTxHash(null)
    setRegisteredAgentId(null)
    try {
      await ensureBaseChain()
      const account = getAddress(connectedAddress as Address)

      const sim = await publicClient.simulateContract({
        account,
        address: registryAddress,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [uri],
      })
      const hashRaw = await walletClient.writeContract(sim.request)
      const tx = String(hashRaw ?? '').trim() as Hex
      if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) throw new Error('Invalid tx hash returned from wallet.')

      setTxHash(tx)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      const parsed = parseEventLogs({
        abi: [ERC8004_REGISTERED_EVENT],
        logs: receipt.logs,
        eventName: 'Registered',
        strict: false,
      })
      const first = parsed[0] as any
      const agentIdRaw = first?.args?.agentId
      const agentId = typeof agentIdRaw === 'bigint' ? agentIdRaw.toString() : null
      setRegisteredAgentId(agentId)

      setSuccess(agentId ? `Agent registered successfully (ID #${agentId}).` : 'Agent registered successfully.')
    } catch (e) {
      setError(getReadableError(e))
    } finally {
      setBusy(false)
    }
  }, [agentUri, canSubmit, connectedAddress, ensureBaseChain, publicClient, registryAddress, walletClient])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <PageMeta
        title={META.agentRegister.title}
        description={META.agentRegister.description}
        canonicalPath="/agents/register"
      />

      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Register Agent</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Create your ERC-8004 agent identity on Base.</p>
          </div>
        </div>
        <Link
          to="/agents"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:text-zinc-100"
        >
          Back to Agents
        </Link>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/2 p-5">
        <div className="flex items-start gap-3 text-xs text-zinc-400">
          <Sparkles className="mt-0.5 h-4 w-4 text-brand-primary/80" />
          <div>
            Use an agent URI from your hosted metadata endpoint, IPFS, Arweave, or data URI.
            <div className="mt-1">
              Need help generating one?{' '}
              <Link to="/agents/uri-service" className="text-brand-primary hover:underline">
                Open Agent URI Service
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
          Registry: <span className="font-mono text-zinc-300">{registryAddress}</span> (Base)
        </div>

        <div className="space-y-2">
          <label htmlFor="agent-uri" className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Agent URI
          </label>
          <textarea
            id="agent-uri"
            value={agentUri}
            onChange={(e) => setAgentUri(e.target.value)}
            rows={6}
            placeholder="https://... or ipfs://... or ar://..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onRegister()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/15 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Registering…' : 'Register Agent'}
          </button>
          {!isConnected ? <span className="text-xs text-zinc-500">Connect wallet to continue.</span> : null}
        </div>

        {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        {success ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{success}</span>
            </div>
            {txHash ? (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-100 hover:underline"
              >
                View transaction
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {registeredAgentId ? <div className="text-xs text-emerald-100/80">Registered Agent ID: #{registeredAgentId}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

