import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  guardAgentApiRequest,
} from '../../../packages/server-core/src/index.js'

import { buildAgentRegistration } from '../../../server/_lib/agentRegistration.js'
import {
  publishAgentRegistrationToGrove,
  resolveAgentRegistrationKey,
} from '../../../server/_lib/agentRegistrationPublisher.js'
import { DEFAULT_CHAIN_ID } from '../../../server/zora/_shared.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { resolveLensUserByOwner } from '../../../server/_lib/lensAccounts.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'
import { buildShareTokenMetadata } from '../../../server/_lib/shareTokenMetadata.js'
import { requireServerKey } from '../../../server/zora/_shared.js'
import { executeUniswapSkill, type UniswapSkillName } from '../../../server/uniswap/agentSkills.js'


type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ExecuteRequest = {
  tool?: string
  input?: Record<string, unknown>
}

function normalizeAddress(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const guard = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'openclaw/execute',
    kind: 'build',
  })
  if (!guard.ok) return

  const body = (await readJsonBody<ExecuteRequest>(req)) ?? {}
  const tool = typeof body.tool === 'string' ? body.tool.trim() : ''
  const input = body.input ?? {}

  if (!tool) {
    return res.status(400).json({ success: false, error: 'tool is required' } satisfies ApiEnvelope<never>)
  }

  try {

    if (
      tool === 'uniswap_quote' ||
      tool === 'uniswap_check_approval' ||
      tool === 'uniswap_build_swap' ||
      tool === 'uniswap_batch_swap_5792' ||
      tool === 'uniswap_delegated_swap_7702' ||
      tool === 'uniswap_crosschain_plan' ||
      tool === 'uniswap_liquidity'
    ) {
      const payload = input && typeof input.payload === 'object' && !Array.isArray(input.payload)
        ? (input.payload as Record<string, unknown>)
        : {}
      const data = await executeUniswapSkill(tool as UniswapSkillName, payload)
      return res.status(200).json({ success: true, data } satisfies ApiEnvelope<unknown>)
    }

    if (tool === 'lens_mapping') {
      const walletRaw = normalizeAddress(input.address)
      if (!walletRaw || !isAddressLike(walletRaw)) {
        return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
      }
      const canonicalWallet = (await resolveCanonicalSmartWalletAddress(walletRaw)) ?? walletRaw
      const lensUser = await resolveLensUserByOwner(canonicalWallet)
      if (!lensUser) {
        return res.status(200).json({ success: true, data: { mapping: null } })
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

      const shouldStore = input.store !== false
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(mapping)
        if (attempt.ok) grove = attempt.result
      }
      return res.status(200).json({ success: true, data: { mapping, grove } })
    }

    if (tool === 'lens_graph') {
      const walletRaw = normalizeAddress(input.address)
      if (!walletRaw || !isAddressLike(walletRaw)) {
        return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
      }
      const canonicalWallet = (await resolveCanonicalSmartWalletAddress(walletRaw)) ?? walletRaw
      const lensUser = await resolveLensUserByOwner(canonicalWallet)
      if (!lensUser) {
        return res.status(200).json({ success: true, data: { graph: null } })
      }

      const walletNodeId = `wallet:${canonicalWallet}`
      const lensAccountId = `lens:account:${lensUser.accountAddress.toLowerCase()}`
      const lensOwnerId = lensUser.ownerAddress ? `lens:owner:${lensUser.ownerAddress.toLowerCase()}` : null

      const nodes = [
        { id: walletNodeId, label: canonicalWallet, type: 'wallet', address: canonicalWallet },
        {
          id: lensAccountId,
          label: lensUser.handle ? `@${lensUser.handle}` : lensUser.accountAddress,
          type: 'lens-account',
          address: lensUser.accountAddress,
          handle: lensUser.handle,
        },
      ]

      const edges = [{ source: walletNodeId, target: lensAccountId, type: 'wallet_to_lens' }]

      if (lensOwnerId) {
        nodes.push({
          id: lensOwnerId,
          label: lensUser.ownerAddress ?? '',
          type: 'lens-owner',
          address: lensUser.ownerAddress ?? '',
        })
        edges.push({ source: lensAccountId, target: lensOwnerId, type: 'lens_to_owner' })
      }

      const groups = [
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

      const shouldStore = input.store !== false
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(graph)
        if (attempt.ok) grove = attempt.result
      }
      return res.status(200).json({ success: true, data: { graph, grove } })
    }

    if (tool === 'share_token_metadata') {
      const tokenRaw = normalizeAddress(input.address)
      if (!tokenRaw || !isAddressLike(tokenRaw)) {
        return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
      }
      const chainId = Number(input.chainId ?? DEFAULT_CHAIN_ID)
      const metadata = await buildShareTokenMetadata({
        address: tokenRaw as Address,
        chainId,
        rpcUrl: process.env.BASE_RPC_URL,
        apiHost: process.env.API_HOST,
        appHost: process.env.APP_HOST,
        zoraKey: requireServerKey(),
      })
      const shouldStore = input.store !== false
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(metadata)
        if (attempt.ok) grove = attempt.result
      }
      return res.status(200).json({ success: true, data: { metadata, grove } })
    }

    if (tool === 'erc8004_read_feedback') {
      const agentIdRaw = Number(input.agentId ?? 0)
      if (!Number.isFinite(agentIdRaw) || agentIdRaw < 0) {
        return res.status(400).json({ success: false, error: 'agentId is required' } satisfies ApiEnvelope<never>)
      }

      const { createPublicClient, http, isAddress: isAddr, getAddress: getAddr } = await import('viem')
      const { base } = await import('viem/chains')
      const { getReputationRegistryAddress, REPUTATION_REGISTRY_ABI, formatFeedbackValue, ratingLabel } = await import(
        '../../../server/_lib/erc8004.js'
      )

      const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
      const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 12_000 }) })
      const registry = getReputationRegistryAddress()
      const agentId = BigInt(agentIdRaw)

      const mode = String(input.mode ?? 'summary').trim().toLowerCase()
      const tag1 = String(input.tag1 ?? '')
      const tag2 = String(input.tag2 ?? '')
      const includeRevoked = Boolean(input.includeRevoked)
      const clientRaw = String(input.client ?? '').trim()
      const clientAddress = clientRaw && isAddr(clientRaw) ? getAddr(clientRaw) : null

      // Resolve client addresses
      let clientAddresses: `0x${string}`[] = []
      if (clientAddress) {
        clientAddresses = [clientAddress]
      } else {
        const allClients = await client.readContract({
          address: registry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'getClients',
          args: [agentId],
        }) as `0x${string}`[]
        clientAddresses = allClients
      }

      if (clientAddresses.length === 0) {
        return res.status(200).json({
          success: true,
          data: { summary: { agentId: agentIdRaw, count: 0, displayValue: '0' }, totalClients: 0 },
        })
      }

      if (mode === 'all') {
        const result = await client.readContract({
          address: registry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'readAllFeedback',
          args: [agentId, clientAddresses, tag1, tag2, includeRevoked],
        }) as [string[], bigint[], bigint[], number[], string[], string[], boolean[]]

        const [clients, indexes, values, decimals, t1s, t2s, revoked] = result
        const feedback = clients.map((c: string, i: number) => ({
          clientAddress: c,
          feedbackIndex: Number(indexes[i]),
          value: Number(values[i]),
          valueDecimals: decimals[i],
          tag1: t1s[i],
          tag2: t2s[i],
          isRevoked: revoked[i],
          displayValue: formatFeedbackValue(values[i], decimals[i]),
        }))
        return res.status(200).json({ success: true, data: { feedback, count: feedback.length } })
      }

      // Summary mode
      const result = await client.readContract({
        address: registry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getSummary',
        args: [agentId, clientAddresses, tag1, tag2],
      }) as [bigint, bigint, number]

      const [count, summaryValue, summaryValueDecimals] = result
      const displayValue = formatFeedbackValue(summaryValue, summaryValueDecimals)
      const numericValue = Number(summaryValue) / (summaryValueDecimals > 0 ? 10 ** summaryValueDecimals : 1)

      return res.status(200).json({
        success: true,
        data: {
          summary: {
            agentId: agentIdRaw,
            count: Number(count),
            summaryValue: Number(summaryValue),
            summaryValueDecimals,
            displayValue,
          },
          totalClients: clientAddresses.length,
          label: ratingLabel(numericValue),
          reputationRegistry: registry,
        },
      })
    }

    if (tool === 'erc8004_build_feedback') {
      const { encodeFunctionData, keccak256, toHex } = await import('viem')
      const { getReputationRegistryAddress, REPUTATION_REGISTRY_ABI } = await import(
        '../../../server/_lib/erc8004.js'
      )

      const registry = getReputationRegistryAddress()
      const action = String(input.action ?? '').trim().toLowerCase()
      const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      if (action === 'give') {
        const agentId = BigInt(String(input.agentId ?? ''))
        const value = BigInt(String(input.value ?? '0'))
        const valueDecimals = Number(input.valueDecimals ?? 0)
        const tag1 = String(input.tag1 ?? '')
        const tag2 = String(input.tag2 ?? '')
        const endpoint = String(input.endpoint ?? '')
        const feedbackURI = String(input.feedbackURI ?? '')
        let feedbackHash = ZERO_BYTES32
        if (feedbackURI) feedbackHash = keccak256(toHex(feedbackURI))

        const calldata = encodeFunctionData({
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'giveFeedback',
          args: [agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
        })

        return res.status(200).json({
          success: true,
          data: { to: registry, calldata, action: 'giveFeedback', args: { agentId: Number(agentId), value: Number(value), valueDecimals, tag1, tag2 } },
        })
      }

      if (action === 'revoke') {
        const agentId = BigInt(String(input.agentId ?? ''))
        const feedbackIndex = BigInt(String(input.feedbackIndex ?? ''))
        const calldata = encodeFunctionData({
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'revokeFeedback',
          args: [agentId, feedbackIndex],
        })
        return res.status(200).json({
          success: true,
          data: { to: registry, calldata, action: 'revokeFeedback', args: { agentId: Number(agentId), feedbackIndex: Number(feedbackIndex) } },
        })
      }

      if (action === 'respond') {
        const agentId = BigInt(String(input.agentId ?? ''))
        const clientAddress = String(input.clientAddress ?? '').trim() as `0x${string}`
        const feedbackIndex = BigInt(String(input.feedbackIndex ?? ''))
        const responseURI = String(input.responseURI ?? '').trim()
        if (!responseURI) return res.status(400).json({ success: false, error: 'responseURI is required' })
        const responseHash = keccak256(toHex(responseURI))

        const calldata = encodeFunctionData({
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'appendResponse',
          args: [agentId, clientAddress, feedbackIndex, responseURI, responseHash],
        })
        return res.status(200).json({
          success: true,
          data: { to: registry, calldata, action: 'appendResponse', args: { agentId: Number(agentId), clientAddress, feedbackIndex: Number(feedbackIndex) } },
        })
      }

      return res.status(400).json({ success: false, error: 'action must be "give", "revoke", or "respond"' })
    }

    if (tool === 'erc8004_agent_registration') {
      const origin = (() => {
        try {
          return getCanonicalOrigin(req)
        } catch {
          return 'https://4626.fun'
        }
      })()
      const result = buildAgentRegistration(origin)
      if (!result.payload) {
        return res.status(503).json({
          success: false,
          error: result.error || 'Missing ERC-8004 registry configuration.',
          missing: result.missing ?? [],
        })
      }
      const registration = result.payload
      const shouldStore = input.store !== false
      let grove = null
      if (shouldStore) {
        const publish = await publishAgentRegistrationToGrove({
          payload: registration,
          agentKey: resolveAgentRegistrationKey(registration),
        })
        if (publish.ok) {
          grove = {
            lensUri: publish.lensUri,
            gatewayUrl: publish.gatewayUrl,
            storageKey: publish.storageKey ?? publish.lensUri.replace(/^lens:\/\//, ''),
            statusUrl: null,
          }
        }
      }
      return res.status(200).json({ success: true, data: { registration, grove } })
    }

    if (tool === 'erc8004_reputation_graph') {
      const agentIdRaw = Number(input.agentId ?? 0)
      if (!Number.isFinite(agentIdRaw) || agentIdRaw < 0) {
        return res.status(400).json({ success: false, error: 'agentId is required' } satisfies ApiEnvelope<never>)
      }

      const { buildReputationGraph } = await import('../../../server/_lib/reputationGraph.js')
      const graph = await buildReputationGraph({
        agentId: agentIdRaw,
        tag1Filter: String(input.tag1 ?? ''),
        tag2Filter: String(input.tag2 ?? ''),
        includeRevoked: input.includeRevoked !== false,
      })

      const shouldStore = input.store !== false
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(graph)
        if (attempt.ok) {
          grove = {
            lensUri: attempt.result.lensUri,
            gatewayUrl: attempt.result.gatewayUrl,
            storageKey: attempt.result.storageKey,
            statusUrl: attempt.result.statusUrl,
          }
        }
      }

      return res.status(200).json({ success: true, data: { graph, grove } })
    }

    if (tool === 'erc8004_store_feedback_payload') {
      const { keccak256: k256, toHex: tHex } = await import('viem')
      const { getIdentityRegistryAddress } = await import('../../../server/_lib/erc8004.js')

      const agentIdRaw = Number(input.agentId ?? -1)
      if (!Number.isFinite(agentIdRaw) || agentIdRaw < 0) {
        return res.status(400).json({ success: false, error: 'agentId is required' } satisfies ApiEnvelope<never>)
      }

      const chainId = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? '8453')
      const identityRegistry = getIdentityRegistryAddress()
      const agentRegistry = `eip155:${chainId}:${identityRegistry.toLowerCase()}`

      const payload = {
        agentRegistry,
        agentId: agentIdRaw,
        clientAddress: String(input.clientAddress ?? '').trim(),
        createdAt: new Date().toISOString(),
        value: String(input.value ?? '0'),
        valueDecimals: Number(input.valueDecimals ?? 0),
        reasoning: input.reasoning ? String(input.reasoning) : undefined,
        tag1: input.tag1 ? String(input.tag1) : undefined,
        tag2: input.tag2 ? String(input.tag2) : undefined,
        endpoint: input.endpoint ? String(input.endpoint) : undefined,
        attachments: Array.isArray(input.attachments) ? input.attachments : undefined,
      }

      const cleanPayload = JSON.parse(JSON.stringify(payload))
      const canonicalJson = JSON.stringify(cleanPayload, null, 2)
      const feedbackHash = k256(tHex(canonicalJson))

      const shouldStore = input.store !== false
      if (!shouldStore) {
        return res.status(200).json({
          success: true,
          data: { payload: cleanPayload, feedbackHash, feedbackURI: null, gatewayUrl: null },
        })
      }

      const attempt = await tryUploadImmutableJson(cleanPayload)

      // Index in Supabase (async, non-blocking).
      try {
        const { indexFeedback } = await import('../../../server/_lib/walletIntelligenceCache.js')
        void indexFeedback({
          agentId: agentIdRaw,
          clientAddress: String(input.clientAddress ?? '').trim().toLowerCase(),
          feedbackIndex: 0,
          value: Number(input.value ?? 0),
          valueDecimals: Number(input.valueDecimals ?? 0),
          tag1: input.tag1 ? String(input.tag1) : undefined,
          tag2: input.tag2 ? String(input.tag2) : undefined,
          endpoint: input.endpoint ? String(input.endpoint) : undefined,
          feedbackUri: attempt.ok ? attempt.result.lensUri : undefined,
          feedbackHash,
          groveUri: attempt.ok ? attempt.result.lensUri : undefined,
          reasoning: input.reasoning ? String(input.reasoning) : undefined,
        })
      } catch {
        // Supabase indexing is best-effort.
      }

      if (attempt.ok) {
        return res.status(200).json({
          success: true,
          data: {
            payload: cleanPayload,
            feedbackURI: attempt.result.lensUri,
            feedbackHash,
            gatewayUrl: attempt.result.gatewayUrl,
            storageKey: attempt.result.storageKey,
          },
        })
      }
      // Grove unavailable — still return the hash so the caller can proceed on-chain
      return res.status(200).json({
        success: true,
        data: { payload: cleanPayload, feedbackHash, feedbackURI: null, gatewayUrl: null, groveStatus: 'unavailable' },
      })
    }

    // ── Wallet Intelligence tools ──────────────────────────────────────

    if (tool === 'wallet_intelligence') {
      const walletRaw = normalizeAddress(input.address)
      if (!walletRaw || !isAddressLike(walletRaw)) {
        return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
      }

      const { buildWalletIntelligence } = await import('../../../server/_lib/walletIntelligence.js')
      const graph = await buildWalletIntelligence(walletRaw, {
        hops: typeof input.hops === 'number' ? input.hops : undefined,
        chainIds: Array.isArray(input.chainIds) ? input.chainIds.filter((n: unknown): n is number => typeof n === 'number') : undefined,
        includePortfolio: typeof input.includePortfolio === 'boolean' ? input.includePortfolio : undefined,
        includeEns: typeof input.includeEns === 'boolean' ? input.includeEns : undefined,
        includeLens: typeof input.includeLens === 'boolean' ? input.includeLens : undefined,
        includeLabels: typeof input.includeLabels === 'boolean' ? input.includeLabels : undefined,
      })

      const shouldStore = input.store !== false
      let grove = null
      if (shouldStore) {
        const attempt = await tryUploadImmutableJson(graph)
        if (attempt.ok) grove = attempt.result
      }

      return res.status(200).json({ success: true, data: { graph, grove } })
    }

    if (tool === 'wallet_funder_trace') {
      const walletRaw = normalizeAddress(input.address)
      if (!walletRaw || !isAddressLike(walletRaw)) {
        return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
      }

      const { traceFundersMultiChain } = await import('../../../server/_lib/funderTrace.js')
      const result = await traceFundersMultiChain(walletRaw, {
        hops: typeof input.hops === 'number' ? input.hops : undefined,
        chainIds: Array.isArray(input.chainIds) ? input.chainIds.filter((n: unknown): n is number => typeof n === 'number') : undefined,
      })

      return res.status(200).json({ success: true, data: result })
    }

    if (tool === 'wallet_entity_labels') {
      const addresses = Array.isArray(input.addresses)
        ? input.addresses.map((a: unknown) => String(a ?? '').trim().toLowerCase()).filter(isAddressLike)
        : []
      if (addresses.length === 0) {
        return res.status(400).json({ success: false, error: 'addresses array is required' } satisfies ApiEnvelope<never>)
      }

      const { getWalletLabelsBatch } = await import('../../../server/_lib/walletLabels.js')
      const chainId = typeof input.chainId === 'number' ? input.chainId : 8453
      const labels = await getWalletLabelsBatch(addresses, chainId)

      return res.status(200).json({ success: true, data: { labels } })
    }

    if (tool === 'wallet_portfolio') {
      const walletRaw = normalizeAddress(input.address)
      if (!walletRaw || !isAddressLike(walletRaw)) {
        return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
      }

      const { getWalletPortfolio } = await import('../../../server/_lib/debankPortfolio.js')
      const portfolio = await getWalletPortfolio(walletRaw, {
        topTokenCount: typeof input.topTokenCount === 'number' ? input.topTokenCount : undefined,
      })

      return res.status(200).json({ success: true, data: { portfolio } })
    }

    return res.status(400).json({ success: false, error: 'unknown tool' } satisfies ApiEnvelope<never>)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'OpenClaw execution failed'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
