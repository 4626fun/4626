/**
 * ElizaOS Wallet Intelligence Plugin
 *
 * Exposes wallet intelligence tools as XMTP chat commands via the OpenClaw bridge:
 *   /intel <address>      → Full wallet intelligence report
 *   /funder <address>     → Recursive funder tracing
 *   /portfolio <address>  → Portfolio breakdown (net worth, tokens, DeFi)
 *   /labels <address>     → Entity labels (exchange, DeFi, mixer, etc.)
 */

import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

// ---------------------------------------------------------------------------
// OpenClaw bridge (shared pattern)
// ---------------------------------------------------------------------------

type OpenClawBridgeResult = {
  success: boolean
  data?: any
  error?: string
}

function getBridgeOrigin(): string {
  return (
    (process.env.OPENCLAW_BRIDGE_ORIGIN ?? '').trim() ||
    (process.env.CANONICAL_ORIGIN ?? '').trim() ||
    'https://4626.fun'
  )
}

function parseAddressFromText(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return match ? match[0] : null
}

async function callBridge(tool: string, input: Record<string, unknown>): Promise<any> {
  const origin = getBridgeOrigin()
  const res = await fetch(`${origin}/api/openclaw/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  })
  const json = (await res.json().catch(() => null)) as OpenClawBridgeResult | null
  if (!res.ok || !json?.success) {
    const msg = json?.error || `Bridge request failed (${res.status})`
    throw new Error(msg)
  }
  return json.data
}

// ---------------------------------------------------------------------------
// Formatters (human-readable summaries for chat)
// ---------------------------------------------------------------------------

function formatUsd(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '$0'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

function formatIntelSummary(data: any): string {
  const g = data?.graph
  const s = data?.summary
  if (!g || !s) return JSON.stringify(data, null, 2)

  const lines: string[] = [
    `**Wallet Intelligence Report**`,
    '',
    `**Target:** \`${s.target}\``,
  ]

  if (s.canonicalWallet !== s.target) {
    lines.push(`**Canonical Wallet:** \`${s.canonicalWallet}\``)
  }

  if (s.ensName) lines.push(`**ENS:** ${s.ensName}`)
  if (s.lensHandle) lines.push(`**Lens:** @${s.lensHandle}`)
  if (s.netWorth !== null) lines.push(`**Net Worth:** ${formatUsd(s.netWorth)}`)

  lines.push('')
  lines.push(`**Graph:** ${s.nodeCount} nodes, ${s.edgeCount} edges`)
  lines.push(`**Funder Chain:** ${s.funderChainLength} hop${s.funderChainLength !== 1 ? 's' : ''} traced`)
  lines.push(`**Known Entities:** ${s.knownEntities} identified`)

  // Funder chain details
  const funderTrace = g.sources?.funderTrace
  if (funderTrace?.chain?.length > 0) {
    lines.push('')
    lines.push('**Funding Chain:**')
    for (const hop of funderTrace.chain) {
      const label = g.sources?.labels?.[hop.funderAddress]?.labels?.[0]?.name
      const tag = label ? ` (${label})` : ''
      lines.push(`  ${hop.hop}. \`${hop.funderAddress.slice(0, 10)}...${hop.funderAddress.slice(-6)}\`${tag}`)
    }
  }

  // Top tokens
  const portfolio = g.sources?.portfolio
  if (portfolio?.topTokens?.length > 0) {
    lines.push('')
    lines.push('**Top Holdings:**')
    for (const t of portfolio.topTokens.slice(0, 5)) {
      lines.push(`  • ${t.symbol}: ${formatUsd(t.usdValue)}`)
    }
  }

  // DeFi positions
  if (portfolio?.protocols?.length > 0) {
    lines.push('')
    lines.push('**DeFi Positions:**')
    for (const p of portfolio.protocols.slice(0, 5)) {
      lines.push(`  • ${p.name}: ${formatUsd(p.netUsdValue)}`)
    }
  }

  if (data.groveStatus === 'stored' && data.grove?.gatewayUrl) {
    lines.push('')
    lines.push(`**Stored on Grove:** [View](${data.grove.gatewayUrl})`)
  }

  return lines.join('\n')
}

function formatFunderTrace(data: any): string {
  if (!data?.chain?.length) {
    return `No funding chain found for \`${data?.target ?? 'unknown'}\`.`
  }

  const lines: string[] = [
    `**Funder Trace for** \`${data.target}\``,
    '',
    `**Hops traced:** ${data.chain.length}/${data.requestedHops}`,
    `**Complete:** ${data.complete ? 'Yes' : 'No'}${data.stopReason ? ` (${data.stopReason})` : ''}`,
    '',
  ]

  for (const hop of data.chain) {
    const chainName = hop.chainId === 8453 ? 'Base' : hop.chainId === 1 ? 'Ethereum' : `Chain ${hop.chainId}`
    lines.push(`**Hop ${hop.hop}:** \`${hop.funderAddress}\``)
    lines.push(`  Tx: \`${hop.funderTxHash.slice(0, 14)}...\` | Block: ${hop.blockNumber} | ${chainName}`)
  }

  return lines.join('\n')
}

function formatPortfolio(data: any): string {
  const p = data?.portfolio
  if (!p) return 'Portfolio data unavailable.'

  const lines: string[] = [
    `**Portfolio for** \`${p.address}\``,
    '',
    `**Net Worth:** ${formatUsd(p.totalUsdValue)}`,
    `**Active Chains:** ${p.activeChains?.length ?? 0}`,
    `**DeFi Protocols:** ${p.protocols?.length ?? 0}`,
  ]

  if (p.activeChains?.length > 0) {
    lines.push('')
    lines.push('**Chains:**')
    for (const c of p.activeChains.slice(0, 8)) {
      lines.push(`  • ${c.name}: ${formatUsd(c.usdValue)}`)
    }
  }

  if (p.topTokens?.length > 0) {
    lines.push('')
    lines.push('**Top Tokens:**')
    for (const t of p.topTokens.slice(0, 10)) {
      lines.push(`  • ${t.symbol} (${t.chain}): ${formatUsd(t.usdValue)}`)
    }
  }

  if (p.protocols?.length > 0) {
    lines.push('')
    lines.push('**DeFi Positions:**')
    for (const pr of p.protocols.slice(0, 10)) {
      lines.push(`  • ${pr.name} (${pr.chain}): ${formatUsd(pr.netUsdValue)}`)
    }
  }

  return lines.join('\n')
}

function formatLabels(data: any): string {
  const labels = data?.labels
  if (!labels || typeof labels !== 'object') return 'No label data available.'

  const entries = Object.entries(labels) as [string, any][]
  if (entries.length === 0) return 'No addresses to label.'

  const lines: string[] = ['**Entity Labels**', '']

  for (const [addr, result] of entries) {
    if (result.isKnownEntity && result.labels?.length > 0) {
      const tags = result.labels.map((l: any) => `${l.name} (${l.category})`).join(', ')
      lines.push(`\`${addr.slice(0, 10)}...${addr.slice(-6)}\`: ${tags}`)
    } else {
      lines.push(`\`${addr.slice(0, 10)}...${addr.slice(-6)}\`: Unknown`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const walletIntelAction: Action = {
  name: 'WALLET_INTELLIGENCE',
  similes: ['intel', 'investigate', 'wallet intel', 'who is'],
  description: 'Full wallet intelligence report: funder tracing, entity labels, portfolio, ENS, Lens identity.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/intel') || text.startsWith('/investigate') || text.startsWith('/whois')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const fromOptions = typeof options?.address === 'string' ? options.address : null
    const fromText = parseAddressFromText(message.content?.text ?? '')
    const address = fromOptions ?? fromText
    if (!address) {
      await callback?.({ text: 'Usage: `/intel <address>`\nProvide a wallet address to investigate.' } as Content)
      return
    }

    await callback?.({ text: `Investigating \`${address}\`... This may take a few seconds.` } as Content)

    try {
      const data = await callBridge('wallet_intelligence', { address, store: true })
      await callback?.({ text: formatIntelSummary(data) } as Content)
    } catch (err: any) {
      await callback?.({ text: `Failed to generate intelligence report: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/intel 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' } },
      { name: 'agent', content: { text: 'Wallet Intelligence Report\n...' } },
    ],
  ],
}

const funderTraceAction: Action = {
  name: 'WALLET_FUNDER_TRACE',
  similes: ['funder', 'trace funder', 'who funded'],
  description: 'Trace who funded a wallet address recursively up to N hops.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/funder') || text.startsWith('/trace')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const fromOptions = typeof options?.address === 'string' ? options.address : null
    const fromText = parseAddressFromText(message.content?.text ?? '')
    const address = fromOptions ?? fromText
    if (!address) {
      await callback?.({ text: 'Usage: `/funder <address>`\nProvide a wallet address to trace its funding chain.' } as Content)
      return
    }

    try {
      const data = await callBridge('wallet_funder_trace', { address })
      await callback?.({ text: formatFunderTrace(data) } as Content)
    } catch (err: any) {
      await callback?.({ text: `Failed to trace funders: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/funder 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: 'Funder Trace for 0x1234...\nHop 1: ...' } },
    ],
  ],
}

const portfolioAction: Action = {
  name: 'WALLET_PORTFOLIO',
  similes: ['portfolio', 'net worth', 'balance'],
  description: 'Portfolio breakdown: net worth, top tokens, active chains, DeFi positions.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/portfolio') || text.startsWith('/networth') || text.startsWith('/balance')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const fromOptions = typeof options?.address === 'string' ? options.address : null
    const fromText = parseAddressFromText(message.content?.text ?? '')
    const address = fromOptions ?? fromText
    if (!address) {
      await callback?.({ text: 'Usage: `/portfolio <address>`\nProvide a wallet address to check its portfolio.' } as Content)
      return
    }

    try {
      const data = await callBridge('wallet_portfolio', { address })
      await callback?.({ text: formatPortfolio(data) } as Content)
    } catch (err: any) {
      await callback?.({ text: `Failed to fetch portfolio: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/portfolio 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: 'Portfolio for 0x1234...\nNet Worth: $42K\n...' } },
    ],
  ],
}

const entityLabelsAction: Action = {
  name: 'WALLET_ENTITY_LABELS',
  similes: ['labels', 'identify', 'who owns'],
  description: 'Identify known entities for wallet addresses (exchanges, DeFi, mixers, etc.).',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/labels') || text.startsWith('/identify')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text ?? ''
    // Extract all addresses from the message
    const addresses = text.match(/0x[a-fA-F0-9]{40}/g) ?? []
    if (addresses.length === 0) {
      await callback?.({ text: 'Usage: `/labels <address> [address2] ...`\nProvide one or more wallet addresses to identify.' } as Content)
      return
    }

    try {
      const data = await callBridge('wallet_entity_labels', { addresses })
      await callback?.({ text: formatLabels(data) } as Content)
    } catch (err: any) {
      await callback?.({ text: `Failed to resolve labels: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/labels 0x28c6c06298d514db089934071355e5743bf21d60' } },
      { name: 'agent', content: { text: 'Entity Labels\n0x28c6...1d60: Binance (exchange)' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const walletIntelPlugin: Plugin = {
  name: '@creatorvault/plugin-wallet-intel',
  description: 'Wallet intelligence tools — funder tracing, entity labels, portfolio, full reports.',
  actions: [walletIntelAction, funderTraceAction, portfolioAction, entityLabelsAction],
}

export default walletIntelPlugin
