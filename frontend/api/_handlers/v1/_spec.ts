import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
} from '../../../packages/server-core/src/index.js'


import { getCanonicalOrigin } from '../../../server/_lib/origin.js'

type OpenApiSpec = Record<string, any>

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 300) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function resolveServerBaseUrl(req: VercelRequest): string {
  try {
    return `${getCanonicalOrigin(req)}/api`
  } catch {
    return 'https://4626.fun/api'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/spec.json', kind: 'read' })
  if (!g.ok) return

  const spec: OpenApiSpec = {
    openapi: '3.0.3',
    info: {
      title: '4626.fun Agent API',
      version: '1.0.0',
      description: 'Public, agent-friendly API for querying 4626.fun and building onchain transactions (build-only).',
    },
    servers: [{ url: resolveServerBaseUrl(req) }],
    paths: {
      '/v1/spec.json': { get: { summary: 'OpenAPI spec', responses: { '200': { description: 'OK' } } } },
      '/v1/token/{address}/metadata': { get: { summary: 'Share token metadata (ERC-7572)', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/token/{address}/image': { get: { summary: 'Share token image renderer', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/token/{address}/logo.png': { get: { summary: 'Canonical PNG logo alias (64x64 default)', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/token/{address}/logo.svg': { get: { summary: 'Canonical SVG logo alias (64x64 default)', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/token/{address}/tokenlist': { get: { summary: 'Token Lists compatible single-token payload', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/vault/{address}/report': { get: { summary: 'Vault report', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/vault/{address}/strategies': { get: { summary: 'Vault strategies', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/explore/vaults': { get: { summary: 'Explore vault list with optional search, time, and sorting filters', responses: { '200': { description: 'OK' } } } },
      '/v1/auction/{address}/status': { get: { summary: 'CCA strategy auction status', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/auction/{address}/activity': { get: { summary: 'Recent live activity for a CCA strategy auction', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/auction/{address}/recentBids': { get: { summary: 'Recent bids for an auction contract', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/global': { get: { summary: 'Global lottery stats', responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/creator/{creatorCoin}': { get: { summary: 'Creator lottery stats', parameters: [{ name: 'creatorCoin', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/recentWinners': { get: { summary: 'Recent lottery winners (logs)', responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/amoe/nonce': { get: { summary: 'Issue AMOE nonce + signable challenge', responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/amoe/credits': { get: { summary: 'Read AMOE credit balance for a wallet', responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/amoe/submit': { post: { summary: 'Verify AMOE challenge signature and return attested onchain payload', responses: { '200': { description: 'OK' } } } },
      '/v1/lottery/amoe/twitter-checkin': { post: { summary: 'Claim daily Twitter AMOE credit (1 credit/day)', responses: { '200': { description: 'OK' } } } },
      '/v1/gauge/epoch': { get: { summary: 'Gauge epoch info', responses: { '200': { description: 'OK' } } } },
      '/v1/gauge/vaults': { get: { summary: 'Gauge whitelisted vaults + weights', responses: { '200': { description: 'OK' } } } },
      '/v1/gauge/user/{address}': { get: { summary: 'Gauge user votes', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/ve4626/user/{address}': { get: { summary: 've4626 lock + power', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/charm/strategy/{address}': { get: { summary: 'Charm strategy config + status', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/agents/capabilities': { get: { summary: 'Resolve wallet room capabilities + qualification state', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/creators': { get: { summary: 'List creator XMTP agents', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/creators/enable': { post: { summary: 'Enable/provision creator XMTP agent (auth required)', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/feedback/review': { post: { summary: 'x402-gated ERC-8004 technical review with Lens payload + unsigned giveFeedback calldata', responses: { '200': { description: 'Review generated' }, '402': { description: 'Payment required' } } } },
      '/v1/agents/access-proof/request': { post: { summary: 'Issue signable room access proof payload', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/access-proof/verify': { post: { summary: 'Verify signed proof and issue short-lived room token', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/xmtp/join': { post: { summary: 'Validate room token and return XMTP join instructions', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/telegram/join': { post: { summary: 'Validate room token and return Telegram join instructions', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/identity/verification': { get: { summary: 'Public ERC-8004 discoverability report across onchain state, mirrors, and service health', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/profile': {
        get: {
          summary: 'Aggregated public profile for the canonical ERC-8004 agent',
          parameters: [
            { name: 'agentId', in: 'query', required: true, description: 'Canonical ERC-8004 agent token ID', schema: { type: 'integer', minimum: 0 } },
          ],
          responses: { '200': { description: 'OK' }, '404': { description: 'Only the canonical agent profile is exposed' } },
        },
      },
      '/agents': {
        get: {
          summary: 'Directory-compatible agent listing for the public 4626 agent surface',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v1/agents/feedback': {
        get: {
          summary: 'Read ERC-8004 feedback from the onchain registry or indexed cache',
          parameters: [
            { name: 'agentId', in: 'query', required: true, description: 'ERC-8004 agent token ID', schema: { type: 'integer', minimum: 0 } },
            { name: 'client', in: 'query', required: false, description: 'Optional reviewer wallet address', schema: { type: 'string' } },
            { name: 'tag1', in: 'query', required: false, description: 'Optional primary tag filter', schema: { type: 'string' } },
            { name: 'tag2', in: 'query', required: false, description: 'Optional secondary tag filter', schema: { type: 'string' } },
            { name: 'includeRevoked', in: 'query', required: false, description: 'Include revoked feedback entries', schema: { type: 'boolean' } },
            { name: 'mode', in: 'query', required: false, description: 'summary, all, single, or indexed response shape', schema: { type: 'string', enum: ['summary', 'all', 'single', 'indexed'] } },
            { name: 'feedbackIndex', in: 'query', required: false, description: 'Required when mode=single', schema: { type: 'integer', minimum: 0 } },
            { name: 'limit', in: 'query', required: false, description: 'Indexed mode page size', schema: { type: 'integer', minimum: 0 } },
            { name: 'offset', in: 'query', required: false, description: 'Indexed mode offset', schema: { type: 'integer', minimum: 0 } },
            { name: 'orderBy', in: 'query', required: false, description: 'Indexed mode sort column', schema: { type: 'string', enum: ['created_at', 'value'] } },
            { name: 'order', in: 'query', required: false, description: 'Indexed mode sort direction', schema: { type: 'string', enum: ['asc', 'desc'] } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v1/agents/wallet-intelligence': {
        get: {
          summary: 'Build or fetch wallet intelligence for a wallet address',
          parameters: [
            { name: 'address', in: 'query', required: true, description: 'Wallet address to enrich', schema: { type: 'string' } },
            { name: 'hops', in: 'query', required: false, description: 'Funding-trace depth', schema: { type: 'integer', minimum: 1 } },
            { name: 'chains', in: 'query', required: false, description: 'Comma-separated chain IDs to inspect', schema: { type: 'string' } },
            { name: 'store', in: 'query', required: false, description: 'Store immutable Grove fallback when true', schema: { type: 'boolean' } },
            { name: 'portfolio', in: 'query', required: false, description: 'Include portfolio enrichment', schema: { type: 'boolean' } },
            { name: 'ens', in: 'query', required: false, description: 'Include ENS enrichment', schema: { type: 'boolean' } },
            { name: 'lens', in: 'query', required: false, description: 'Include Lens enrichment', schema: { type: 'boolean' } },
            { name: 'labels', in: 'query', required: false, description: 'Include entity labels', schema: { type: 'boolean' } },
            { name: 'noCache', in: 'query', required: false, description: 'Bypass cached intelligence', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Build or fetch wallet intelligence from a JSON request body',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    address: { type: 'string' },
                    hops: { type: 'integer', minimum: 1 },
                    chainIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
                    store: { type: 'boolean' },
                    includePortfolio: { type: 'boolean' },
                    includeEns: { type: 'boolean' },
                    includeLens: { type: 'boolean' },
                    includeLabels: { type: 'boolean' },
                    noCache: { type: 'boolean' },
                  },
                  required: ['address'],
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v1/agents/publish': {
        post: {
          summary: 'publish canonical ERC-8004 registration metadata and optional Grove fallback',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    storeOnGrove: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Publish status' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/lens/agent-registration': {
        get: {
          summary: 'Preview canonical ERC-8004 registration metadata and optional Grove storage status',
          parameters: [
            { name: 'store', in: 'query', required: false, description: 'Store on Grove when true', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'OK' }, '401': { description: 'Authentication required when store=true' } },
        },
        post: {
          summary: 'Store or preview canonical ERC-8004 registration metadata on Lens Grove',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    store: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' }, '401': { description: 'Authentication required when store=true' } },
        },
      },
      '/lens/reputation-graph': {
        get: {
          summary: 'Build or fetch an ERC-8004 reputation graph',
          parameters: [
            { name: 'agentId', in: 'query', required: true, description: 'ERC-8004 agent token ID', schema: { type: 'integer', minimum: 0 } },
            { name: 'tag1', in: 'query', required: false, description: 'Optional primary tag filter', schema: { type: 'string' } },
            { name: 'tag2', in: 'query', required: false, description: 'Optional secondary tag filter', schema: { type: 'string' } },
            { name: 'includeRevoked', in: 'query', required: false, description: 'Include revoked feedback entries', schema: { type: 'boolean' } },
            { name: 'store', in: 'query', required: false, description: 'Store immutable Grove fallback when true', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'OK' }, '401': { description: 'Authentication required when store=true' } },
        },
        post: {
          summary: 'Build or store an ERC-8004 reputation graph from a JSON request body',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    agentId: { type: 'integer', minimum: 0 },
                    tag1: { type: 'string' },
                    tag2: { type: 'string' },
                    includeRevoked: { type: 'boolean' },
                    store: { type: 'boolean' },
                  },
                  required: ['agentId'],
                },
              },
            },
          },
          responses: { '200': { description: 'OK' }, '401': { description: 'Authentication required when store=true' } },
        },
      },
      '/lens/feedback-payload': {
        get: {
          summary: 'Describe the feedback payload contract used for Lens Grove storage',
          responses: { '200': { description: 'OK' } },
        },
        post: {
          summary: 'Build and optionally store an ERC-8004 feedback payload on Lens Grove',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    agentId: { type: 'integer', minimum: 0 },
                    value: { type: 'string' },
                    valueDecimals: { type: 'integer', minimum: 0, maximum: 18 },
                    store: { type: 'boolean' },
                    clientAddress: { type: 'string' },
                    reasoning: { type: 'string' },
                    reproducible: { type: 'boolean' },
                    tag1: { type: 'string' },
                    tag2: { type: 'string' },
                    attachments: { type: 'array', items: { type: 'object' } },
                    proofOfPayment: { type: 'object' },
                    skill: { type: 'string' },
                    domain: { type: 'string' },
                    context: { type: 'string' },
                    capability: { type: 'string' },
                    name: { type: 'string' },
                    endpoint: { type: 'string' },
                  },
                  required: ['agentId', 'value', 'valueDecimals'],
                },
              },
            },
          },
          responses: { '200': { description: 'OK' }, '401': { description: 'Authentication required when store=true' } },
        },
      },

      // Build-only endpoints (return unsigned tx calldata)
      '/v1/build/auction/submitBid': { post: { summary: 'Build CCA submitBid calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/gauge/vote': { post: { summary: 'Build gauge vote calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/gauge/resetVotes': { post: { summary: 'Build gauge resetVotes calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ve4626/lock': { post: { summary: 'Build ve4626 lock calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ve4626/extend': { post: { summary: 'Build ve4626 extendLock calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ve4626/increase': { post: { summary: 'Build ve4626 increaseLock calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ve4626/unlock': { post: { summary: 'Build ve4626 unlock calldata', responses: { '200': { description: 'OK' } } } },

      '/v1/build/ajna/borrow': { post: { summary: 'Build Ajna ERC20Pool drawDebt calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ajna/repay': { post: { summary: 'Build Ajna ERC20Pool repayDebt calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ajna/addCollateral': { post: { summary: 'Build Ajna pledge collateral calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ajna/removeCollateral': { post: { summary: 'Build Ajna pull collateral calldata', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ajna/setMinBucketIndex': { post: { summary: 'Build AjnaVaultAuth setMinBucketIndex calldata (admin, canonical nested path)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/ajna/setIdleBufferBps': { post: { summary: 'Build ERC4626StrategyAdapter setIdleBufferBps calldata (owner, canonical nested path)', responses: { '200': { description: 'OK' } } } },

      '/v1/build/charm/setCharmVault': { post: { summary: 'Build CreatorCharmStrategy setCharmVault calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/setSwapPool': { post: { summary: 'Build CreatorCharmStrategy setSwapPool calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/setUniFactory': { post: { summary: 'Build CreatorCharmStrategy setUniFactory calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/setAutoFeeTier': { post: { summary: 'Build CreatorCharmStrategy setAutoFeeTier calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/setParameters': { post: { summary: 'Build CreatorCharmStrategy setParameters calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/setActive': { post: { summary: 'Build CreatorCharmStrategy setActive calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/initializeApprovals': { post: { summary: 'Build CreatorCharmStrategy initializeApprovals calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/rebalance': { post: { summary: 'Build CreatorCharmStrategy rebalance calldata (owner or vault)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/ownerEmergencyWithdraw': { post: { summary: 'Build CreatorCharmStrategy ownerEmergencyWithdraw calldata (owner)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/ownerEmergencyWithdrawFromCharm': { post: { summary: 'Build CreatorCharmStrategy ownerEmergencyWithdrawFromCharm calldata (owner)', responses: { '200': { description: 'OK' } } } },

      // Charm/AlphaVault-style vault controls
      '/v1/build/charm/vault/rebalance': { post: { summary: 'Build Charm/AlphaVault rebalance calldata (no-arg)', responses: { '200': { description: 'OK' } } } },
      '/v1/build/charm/vault/setStrategy': { post: { summary: 'Build Charm/AlphaVault delegate/manager update calldata', responses: { '200': { description: 'OK' } } } },
    },
  }

  setCache(res, 600)
  return res.status(200).json(spec)
}
