/**
 * ElizaOS Lens Plugin (Unified)
 *
 * Calls server-side Lens modules directly instead of routing
 * through the OpenClaw HTTP bridge.
 *
 *   /lens mapping <address>  → Resolve wallet to Lens profile mapping
 *   /lens graph <address>    → Generate Lens identity graph
 *   /share metadata <address> → Generate ShareOFT metadata
 */

import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

// Direct imports — no HTTP bridge needed
import { resolveLensUserByOwner } from '../../../../_lib/lensAccounts.js'
import { resolveCanonicalSmartWalletAddress } from '../../../../_lib/canonicalWalletResolver.js'
import { tryUploadImmutableJson } from '../../../../_lib/lensGrove.js'
import { buildShareTokenMetadata } from '../../../../_lib/shareTokenMetadata.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAddressFromText(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return match ? match[0] : null
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
  }
  return fallback
}

async function respond(callback: HandlerCallback | undefined, data: any) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  await callback?.({ text } as Content)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const lensMappingAction: Action = {
  name: 'LENS_MAPPING',
  similes: ['lens mapping', 'lens resolve', 'resolve lens'],
  description: 'Resolve a wallet to its canonical Lens profile mapping.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens mapping') || text.startsWith('/lens resolve')
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
      await respond(callback, 'Missing address. Provide a wallet address.')
      return
    }

    try {
      const walletRaw = address.trim().toLowerCase()
      const canonicalWallet = (await resolveCanonicalSmartWalletAddress(walletRaw)) ?? walletRaw
      const lensUser = await resolveLensUserByOwner(canonicalWallet)

      if (!lensUser) {
        await respond(callback, { mapping: null, message: 'No Lens profile found for this wallet.' })
        return
      }

      const mapping = {
        requestedWallet: walletRaw,
        wallet: canonicalWallet,
        lens: {
          handle: lensUser.handle,
          username: lensUser.username,
          displayName: lensUser.displayName,
          avatar: lensUser.avatar,
          accountAddress: lensUser.accountAddress,
          ownerAddress: lensUser.ownerAddress,
        },
        namespaces: {
          wallet: `wallet:${canonicalWallet}`,
          lensHandle: lensUser.handle ? `lens:${lensUser.handle}` : null,
          lensAccount: lensUser.accountAddress ? `lens:account:${lensUser.accountAddress.toLowerCase()}` : null,
          lensOwner: lensUser.ownerAddress ? `lens:owner:${lensUser.ownerAddress.toLowerCase()}` : null,
        },
        generatedAt: new Date().toISOString(),
        source: 'lens.accountsBulk',
      }

      const shouldStore = parseBoolean(options?.store, true)
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(mapping)
        if (attempt.ok) grove = attempt.result
      }

      await respond(callback, { mapping, grove })
    } catch (err: any) {
      await respond(callback, `Lens mapping error: ${err.message}`)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/lens mapping 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: '{"mapping":{"wallet":"0x1234...","lens":{"handle":"@user"}},...}' } },
    ],
  ],
}

const lensGraphAction: Action = {
  name: 'LENS_GRAPH',
  similes: ['lens graph', 'lens network'],
  description: 'Generate a Lens identity graph for a wallet.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens graph') || text.startsWith('/lens network')
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
      await respond(callback, 'Missing address. Provide a wallet address.')
      return
    }

    try {
      const walletRaw = address.trim().toLowerCase()
      const canonicalWallet = (await resolveCanonicalSmartWalletAddress(walletRaw)) ?? walletRaw
      const lensUser = await resolveLensUserByOwner(canonicalWallet)

      if (!lensUser) {
        await respond(callback, { graph: null, message: 'No Lens profile found for this wallet.' })
        return
      }

      const walletNodeId = `wallet:${canonicalWallet}`
      const lensAccountId = `lens:account:${lensUser.accountAddress.toLowerCase()}`
      const lensOwnerId = lensUser.ownerAddress ? `lens:owner:${lensUser.ownerAddress.toLowerCase()}` : null

      const nodes: any[] = [
        { id: walletNodeId, label: canonicalWallet, type: 'wallet', address: canonicalWallet },
        {
          id: lensAccountId,
          label: lensUser.handle ? `@${lensUser.handle}` : lensUser.accountAddress,
          type: 'lens-account',
          address: lensUser.accountAddress,
          handle: lensUser.handle,
        },
      ]

      const edges: any[] = [{ source: walletNodeId, target: lensAccountId, type: 'wallet_to_lens' }]

      if (lensOwnerId) {
        nodes.push({
          id: lensOwnerId,
          label: lensUser.ownerAddress ?? '',
          type: 'lens-owner',
          address: lensUser.ownerAddress ?? undefined,
        })
        edges.push({ source: lensAccountId, target: lensOwnerId, type: 'lens_to_owner' })
      }

      const groups: any[] = [
        {
          id: 'namespace:wallet',
          label: 'Wallet namespace',
          nodeIds: [walletNodeId],
          namespace: `wallet:${canonicalWallet}`,
        },
      ]

      if (lensUser.handle) {
        groups.push({
          id: 'namespace:lens-handle',
          label: `Lens @${lensUser.handle}`,
          nodeIds: [lensAccountId],
          namespace: `lens:${lensUser.handle}`,
        })
      }

      if (lensOwnerId) {
        groups.push({
          id: 'namespace:lens-owner',
          label: 'Lens owner',
          nodeIds: [lensOwnerId],
          namespace: lensOwnerId,
        })
      }

      const graph = {
        requestedWallet: walletRaw,
        wallet: canonicalWallet,
        nodes,
        edges,
        groups,
        generatedAt: new Date().toISOString(),
        source: 'lens.accountsBulk',
      }

      const shouldStore = parseBoolean(options?.store, true)
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(graph)
        if (attempt.ok) grove = attempt.result
      }

      await respond(callback, { graph, grove })
    } catch (err: any) {
      await respond(callback, `Lens graph error: ${err.message}`)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/lens graph 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: '{"graph":{"nodes":[...],"edges":[...]},...}' } },
    ],
  ],
}

const shareTokenMetadataAction: Action = {
  name: 'SHARE_TOKEN_METADATA',
  similes: ['share token metadata', 'shareoft metadata'],
  description: 'Generate Grove-backed ShareOFT metadata for a token address.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/share metadata') || text.startsWith('/shareoft metadata')
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
      await respond(callback, 'Missing address. Provide a ShareOFT address.')
      return
    }

    try {
      const tokenRaw = address.trim().toLowerCase() as `0x${string}`
      const chainId = typeof options?.chainId === 'number' ? options.chainId : 8453

      const metadata = await buildShareTokenMetadata({
        address: tokenRaw,
        chainId,
        rpcUrl: process.env.BASE_RPC_URL,
        apiHost: process.env.API_HOST,
        appHost: process.env.APP_HOST,
        zoraKey: process.env.ZORA_API_KEY,
      })

      const shouldStore = parseBoolean(options?.store, true)
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(metadata)
        if (attempt.ok) grove = attempt.result
      }

      await respond(callback, { metadata, grove })
    } catch (err: any) {
      await respond(callback, `Share token metadata error: ${err.message}`)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/share metadata 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: '{"metadata":{"name":"...","symbol":"..."},...}' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const lensPlugin: Plugin = {
  name: 'creatorvault-lens',
  description: 'Lens mapping, graph, and ShareOFT metadata tools — direct server-side calls.',
  actions: [lensMappingAction, lensGraphAction, shareTokenMetadataAction],
}

export default lensPlugin
