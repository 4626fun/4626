/**
 * ElizaOS Lens Plugin (Unified)
 *
 * Calls server-side Lens modules directly instead of routing
 * through the OpenClaw HTTP bridge.
 *
 *   /lens mapping <address>   → Resolve wallet to Lens profile mapping
 *   /lens graph <address>     → Generate Lens identity graph
 *   /lens feed <address>      → Fetch recent posts from a Lens account
 *   /lens followers <address> → List followers of a Lens account
 *   /share metadata <address> → Generate ShareOFT metadata
 */

import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

// Direct imports — no HTTP bridge needed
import { resolveLensUserByOwner } from '../../../../_lib/lensAccounts.js'
import { resolveCanonicalSmartWalletAddress } from '../../../../_lib/canonicalWalletResolver.js'
import { tryUploadImmutableJson } from '../../../../_lib/lensGrove.js'
import { buildShareTokenMetadata } from '../../../../_lib/shareTokenMetadata.js'
import { lensGql } from '../../../../_lib/lensClient.js'

// ---------------------------------------------------------------------------
// GraphQL queries (replaces SDK typed-document imports)
// ---------------------------------------------------------------------------

const POSTS_QUERY = /* GraphQL */ `
  query Posts($request: PostsRequest!) {
    posts(request: $request) {
      items {
        ... on Post {
          id
          timestamp
          metadata {
            ... on TextOnlyMetadata { content mainContentFocus }
            ... on ArticleMetadata { content mainContentFocus }
            ... on ImageMetadata { content mainContentFocus }
            ... on VideoMetadata { content mainContentFocus }
            ... on AudioMetadata { content mainContentFocus }
            ... on LinkMetadata { content mainContentFocus }
          }
          stats { reactions comments reposts }
          app { address }
        }
      }
    }
  }
`

const FOLLOWERS_QUERY = /* GraphQL */ `
  query Followers($request: FollowersRequest!) {
    followers(request: $request) {
      items {
        follower {
          address
          username { value }
          metadata { name }
        }
      }
    }
  }
`

const FOLLOWING_QUERY = /* GraphQL */ `
  query Following($request: FollowingRequest!) {
    following(request: $request) {
      items {
        following {
          address
          username { value }
          metadata { name }
        }
      }
    }
  }
`

const ACCOUNT_QUERY = /* GraphQL */ `
  query Account($request: AccountRequest!) {
    account(request: $request) {
      address
      owner
      username { value localName }
      metadata { name bio picture }
      score
      createdAt
      operations {
        canFollow
        canUnfollow
        canBlock
        canUnblock
      }
    }
  }
`

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
// Lens Feed Action — fetch recent posts from a Lens account
// ---------------------------------------------------------------------------

const lensFeedAction: Action = {
  name: 'LENS_FEED',
  similes: ['lens feed', 'lens posts', 'lens timeline'],
  description: 'Fetch recent posts from a Lens account by wallet address.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens feed') || text.startsWith('/lens posts')
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

      // Resolve to Lens account first
      const lensUser = await resolveLensUserByOwner(canonicalWallet)
      if (!lensUser) {
        await respond(callback, { feed: null, message: 'No Lens profile found for this wallet.' })
        return
      }

      const limit = typeof options?.limit === 'number' ? Math.min(options.limit, 25) : 10

      const result = await lensGql<{ posts: { items: any[] } }>(POSTS_QUERY, {
        request: {
          filter: {
            authors: [lensUser.accountAddress],
            postTypes: ['ROOT', 'COMMENT'],
          },
        },
      })

      const items = (result?.posts?.items ?? []).slice(0, limit)
      const posts = items.map((p: any) => ({
        id: p.id,
        type: p.__typename,
        content: p.metadata?.content ?? null,
        contentFocus: p.metadata?.mainContentFocus ?? null,
        timestamp: p.timestamp,
        stats: p.stats ?? null,
        app: p.app?.address ?? null,
      }))

      await respond(callback, {
        account: {
          address: lensUser.accountAddress,
          handle: lensUser.handle,
          displayName: lensUser.displayName,
        },
        posts,
        count: posts.length,
      })
    } catch (err: any) {
      await respond(callback, `Lens feed error: ${err.message}`)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/lens feed 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: '{"account":{"handle":"@user"},"posts":[...],"count":10}' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Lens Followers Action — list followers of a Lens account
// ---------------------------------------------------------------------------

const lensFollowersAction: Action = {
  name: 'LENS_FOLLOWERS',
  similes: ['lens followers', 'lens following'],
  description: 'List followers or following of a Lens account by wallet address.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens followers') || text.startsWith('/lens following')
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

    const text = (message.content?.text ?? '').trim().toLowerCase()
    const isFollowing = text.includes('following')

    try {
      const walletRaw = address.trim().toLowerCase()
      const canonicalWallet = (await resolveCanonicalSmartWalletAddress(walletRaw)) ?? walletRaw

      const lensUser = await resolveLensUserByOwner(canonicalWallet)
      if (!lensUser) {
        await respond(callback, { result: null, message: 'No Lens profile found for this wallet.' })
        return
      }

      const limit = typeof options?.limit === 'number' ? Math.min(options.limit, 50) : 20

      if (isFollowing) {
        const result = await lensGql<{ following: { items: any[] } }>(FOLLOWING_QUERY, {
          request: {
            account: lensUser.accountAddress,
            orderBy: 'ACCOUNT_SCORE',
          },
        })

        const items = (result?.following?.items ?? []).slice(0, limit)
        const following = items.map((f: any) => ({
          address: f.following?.address ?? f.address,
          username: f.following?.username?.value ?? f.username?.value ?? null,
          displayName: f.following?.metadata?.name ?? f.metadata?.name ?? null,
        }))

        await respond(callback, {
          account: {
            address: lensUser.accountAddress,
            handle: lensUser.handle,
            displayName: lensUser.displayName,
          },
          direction: 'following',
          accounts: following,
          count: following.length,
        })
      } else {
        const result = await lensGql<{ followers: { items: any[] } }>(FOLLOWERS_QUERY, {
          request: {
            account: lensUser.accountAddress,
            orderBy: 'ACCOUNT_SCORE',
          },
        })

        const items = (result?.followers?.items ?? []).slice(0, limit)
        const followers = items.map((f: any) => ({
          address: f.follower?.address ?? f.address,
          username: f.follower?.username?.value ?? f.username?.value ?? null,
          displayName: f.follower?.metadata?.name ?? f.metadata?.name ?? null,
        }))

        await respond(callback, {
          account: {
            address: lensUser.accountAddress,
            handle: lensUser.handle,
            displayName: lensUser.displayName,
          },
          direction: 'followers',
          accounts: followers,
          count: followers.length,
        })
      }
    } catch (err: any) {
      await respond(callback, `Lens followers error: ${err.message}`)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/lens followers 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: '{"account":{"handle":"@user"},"direction":"followers","accounts":[...],"count":20}' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Lens Account Info Action — get detailed account info
// ---------------------------------------------------------------------------

const lensAccountAction: Action = {
  name: 'LENS_ACCOUNT',
  similes: ['lens account', 'lens profile', 'lens info'],
  description: 'Get detailed Lens account information for a wallet address.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens account') || text.startsWith('/lens profile') || text.startsWith('/lens info')
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
        await respond(callback, { account: null, message: 'No Lens profile found for this wallet.' })
        return
      }

      const accountResult = await lensGql<{ account: any }>(ACCOUNT_QUERY, {
        request: { address: lensUser.accountAddress },
      })

      const acct = accountResult?.account
      if (!acct) {
        await respond(callback, { account: null, message: 'Could not fetch account details.' })
        return
      }

      await respond(callback, {
        account: {
          address: acct.address,
          owner: acct.owner,
          username: acct.username?.value ?? null,
          localName: acct.username?.localName ?? null,
          displayName: acct.metadata?.name ?? null,
          bio: acct.metadata?.bio ?? null,
          picture: acct.metadata?.picture ?? null,
          score: acct.score ?? 0,
          createdAt: acct.createdAt,
          operations: acct.operations ?? null,
        },
      })
    } catch (err: any) {
      await respond(callback, `Lens account error: ${err.message}`)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/lens account 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: '{"account":{"address":"0x...","username":"lens/user","score":42}}' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const lensPlugin: Plugin = {
  name: 'creatorvault-lens',
  description: 'Lens mapping, graph, feed, followers, account info, and ShareOFT metadata tools — direct server-side calls.',
  actions: [
    lensMappingAction,
    lensGraphAction,
    lensFeedAction,
    lensFollowersAction,
    lensAccountAction,
    shareTokenMetadataAction,
  ],
}

export default lensPlugin
