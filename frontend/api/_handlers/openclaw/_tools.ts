import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../packages/server-core/src/index.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ToolSchema = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const tools: ToolSchema[] = [
    {
      name: 'referral_og',
      description: 'Generate strict JSON referral OG creative for 4626.',
      inputSchema: {
        type: 'object',
        properties: {
          context: { type: 'object', description: 'Creative context payload.' },
        },
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'share_page_copy',
      description: 'Generate strict JSON share-page copy for 4626.',
      inputSchema: {
        type: 'object',
        properties: {
          context: { type: 'object', description: 'Creative context payload.' },
        },
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'quest_reward',
      description: 'Generate deterministic quest reward JSON for 4626.',
      inputSchema: {
        type: 'object',
        properties: {
          context: { type: 'object', description: 'Quest state payload.' },
        },
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'metadata_bundle',
      description: 'Generate strict JSON metadata bundle for 4626 asset packaging.',
      inputSchema: {
        type: 'object',
        properties: {
          context: { type: 'object', description: 'Metadata context payload.' },
        },
      },
      outputSchema: { type: 'object' },
    },

    {
      name: 'uniswap_quote',
      description: 'Create a Uniswap swap quote via structured agent skill.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'uniswap_check_approval',
      description: 'Check token approval requirement on Uniswap.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'uniswap_build_swap',
      description: 'Build swap transaction payload from Uniswap quote.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'uniswap_batch_swap_5792',
      description: 'Build EIP-5792 batch calls for Uniswap swap.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'uniswap_delegated_swap_7702',
      description: 'Build EIP-7702 delegated swap payload.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'uniswap_crosschain_plan',
      description: 'Create/update cross-chain swap plan with Uniswap.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'uniswap_liquidity',
      description: 'Invoke Uniswap liquidity skill action.',
      inputSchema: { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
      outputSchema: { type: 'object' },
    },
    {
      name: 'lens_mapping',
      description: 'Resolve a wallet to its canonical Lens profile mapping.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address (EOA or CSW).' },
          store: { type: 'boolean', description: 'Store the mapping in Lens Grove.' },
        },
        required: ['address'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'lens_graph',
      description: 'Generate a Lens identity graph for a wallet.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address (EOA or CSW).' },
          store: { type: 'boolean', description: 'Store the graph in Lens Grove.' },
        },
        required: ['address'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'share_token_metadata',
      description: 'Generate and optionally store Grove-backed ShareOFT metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'ShareOFT address on Base.' },
          chainId: { type: 'number', description: 'Chain ID (default 8453).' },
          store: { type: 'boolean', description: 'Store the metadata in Lens Grove.' },
        },
        required: ['address'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'erc8004_agent_registration',
      description: 'Publish the ERC-8004 agent registration to Lens Grove.',
      inputSchema: {
        type: 'object',
        properties: {
          store: { type: 'boolean', description: 'Store the registration in Lens Grove.' },
        },
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'erc8004_read_feedback',
      description: 'Read feedback summary or all feedback for an ERC-8004 agent from the on-chain Reputation Registry.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'number', description: 'Agent token ID in the Identity Registry.' },
          mode: { type: 'string', enum: ['summary', 'all'], description: 'Read mode (default: summary).' },
          tag1: { type: 'string', description: 'Filter by tag1.' },
          tag2: { type: 'string', description: 'Filter by tag2.' },
          client: { type: 'string', description: 'Filter by client address.' },
          includeRevoked: { type: 'boolean', description: 'Include revoked feedback (default: false).' },
        },
        required: ['agentId'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'erc8004_build_feedback',
      description: 'Build unsigned calldata for submitting feedback (giveFeedback), revoking feedback, or appending a response on the ERC-8004 Reputation Registry.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['give', 'revoke', 'respond'], description: 'Feedback action.' },
          agentId: { type: 'number', description: 'Agent token ID.' },
          value: { type: 'number', description: 'Feedback value (e.g. 1-5 for stars). Required for give.' },
          valueDecimals: { type: 'number', description: 'Decimal precision (0 for integer stars). Default: 0.' },
          tag1: { type: 'string', description: 'Primary tag (e.g. "fast", "accurate").' },
          tag2: { type: 'string', description: 'Secondary tag.' },
          endpoint: { type: 'string', description: 'Endpoint tested.' },
          feedbackURI: { type: 'string', description: 'URI to off-chain feedback payload (IPFS/HTTPS).' },
          feedbackIndex: { type: 'number', description: 'Feedback index (for revoke/respond).' },
          clientAddress: { type: 'string', description: 'Client address (for respond).' },
          responseURI: { type: 'string', description: 'Response URI (for respond).' },
        },
        required: ['action', 'agentId'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'erc8004_reputation_graph',
      description: 'Build an ERC-8004 reputation graph for an agent from on-chain feedback and store it on Lens Grove. Returns a graph with agent, reviewer, and feedback nodes plus edges.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'number', description: 'Agent token ID in the Identity Registry.' },
          tag1: { type: 'string', description: 'Filter feedback by tag1.' },
          tag2: { type: 'string', description: 'Filter feedback by tag2.' },
          includeRevoked: { type: 'boolean', description: 'Include revoked feedback (default: true).' },
          store: { type: 'boolean', description: 'Store the graph on Lens Grove (default: true).' },
        },
        required: ['agentId'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'erc8004_store_feedback_payload',
      description: 'Store a v2.0 feedback payload on Lens Grove and return the content-addressed feedbackURI + feedbackHash for use in the on-chain giveFeedback call.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'number', description: 'Agent token ID.' },
          value: { type: 'string', description: 'Feedback value (e.g. "5" for 5 stars).' },
          valueDecimals: { type: 'number', description: 'Decimal precision (0 for integer stars). Default: 0.' },
          reasoning: { type: 'string', description: 'Human-readable reasoning for the feedback.' },
          tag1: { type: 'string', description: 'Primary tag.' },
          tag2: { type: 'string', description: 'Secondary tag.' },
          endpoint: { type: 'string', description: 'Endpoint tested.' },
          clientAddress: { type: 'string', description: 'Client wallet address (CAIP-10 or plain).' },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                uri: { type: 'string' },
                mimeType: { type: 'string' },
                description: { type: 'string' },
              },
            },
            description: 'Evidence attachments (IPFS/HTTPS URIs).',
          },
          store: { type: 'boolean', description: 'Upload to Lens Grove (default: true).' },
        },
        required: ['agentId', 'value'],
      },
      outputSchema: { type: 'object' },
    },

    // ── Wallet Intelligence tools ──────────────────────────────────────
    {
      name: 'wallet_intelligence',
      description: 'Full wallet intelligence report: recursive funder tracing, entity labels, portfolio/net-worth, ENS, Lens identity. Returns an enriched graph optionally stored on Lens Grove.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address (EOA or CSW).' },
          hops: { type: 'number', description: 'Number of funder hops to trace (default 3, max 5).' },
          chainIds: { type: 'array', items: { type: 'number' }, description: 'Chain IDs for funder tracing (default [8453, 1]).' },
          includePortfolio: { type: 'boolean', description: 'Include DeBank portfolio data (default true).' },
          includeEns: { type: 'boolean', description: 'Include ENS mainnet resolution (default true).' },
          includeLens: { type: 'boolean', description: 'Include Lens Protocol identity (default true).' },
          includeLabels: { type: 'boolean', description: 'Include entity labels (default true).' },
          store: { type: 'boolean', description: 'Store the graph on Lens Grove (default true).' },
        },
        required: ['address'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'wallet_funder_trace',
      description: 'Trace who funded a wallet address recursively up to N hops using Etherscan v2 "Funded By" API. Returns the funder chain with tx hashes and timestamps.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address to trace.' },
          hops: { type: 'number', description: 'Number of hops (default 3, max 5).' },
          chainIds: { type: 'array', items: { type: 'number' }, description: 'Chain IDs to trace on (default [8453, 1]).' },
        },
        required: ['address'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'wallet_entity_labels',
      description: 'Resolve known entity labels for one or more wallet addresses (e.g. "Coinbase", "Binance", "Uniswap") with categories.',
      inputSchema: {
        type: 'object',
        properties: {
          addresses: { type: 'array', items: { type: 'string' }, description: 'Wallet addresses to label.' },
          chainId: { type: 'number', description: 'Chain ID for label resolution (default 8453 = Base).' },
        },
        required: ['addresses'],
      },
      outputSchema: { type: 'object' },
    },
    {
      name: 'wallet_portfolio',
      description: 'Enhanced portfolio breakdown for a wallet: net worth, top token holdings, active chains, DeFi protocol positions.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address.' },
          topTokenCount: { type: 'number', description: 'Max number of top tokens to return (default 20).' },
        },
        required: ['address'],
      },
      outputSchema: { type: 'object' },
    },
  ]

  return res.status(200).json({ success: true, data: { tools } } satisfies ApiEnvelope<{ tools: ToolSchema[] }>)
}
