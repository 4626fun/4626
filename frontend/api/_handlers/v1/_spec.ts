import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../server/_lib/agentApiGuard.js'

type OpenApiSpec = Record<string, any>

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 300) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
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
    servers: [{ url: 'https://4626.fun/api' }],
    paths: {
      '/v1/spec.json': { get: { summary: 'OpenAPI spec', responses: { '200': { description: 'OK' } } } },
      '/v1/vault/{address}/report': { get: { summary: 'Vault report', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/v1/vault/{address}/strategies': { get: { summary: 'Vault strategies', parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
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
      '/v1/agents/creators': { get: { summary: 'List creator XMTP agents', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/creators/enable': { post: { summary: 'Enable/provision creator XMTP agent (auth required)', responses: { '200': { description: 'OK' } } } },
      '/v1/agents/identity/verification': { get: { summary: 'Public ERC-8004 agent verification snapshot', responses: { '200': { description: 'OK' } } } },

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

