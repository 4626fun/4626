#!/usr/bin/env node
/**
 * End-to-end smoke for the protocol CSW cutover (on-chain, static mirrors, optional Railway).
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-protocol-csw-cutover.ts
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-protocol-csw-cutover.ts --skip-railway
 */

import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { PROTOCOL_CSW_ADDRESS } from '../../src/wallet/canonicalWalletPolicy.js'
import { resolveServerAgentCswAddress } from '../../server/_lib/wallet/canonicalCswEnv.js'

const ROUTER_ABI = [
  { type: 'function', name: 'allowlistPublisher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'pointsLedgerPublisher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const IDENTITY_REGISTRY_ABI = [
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
] as const

const XMTP_PROJECT_ID = '52c8340d-5b65-458a-b1b4-d51d0ff04675'
const XMTP_ENV_ID = '1ba4dc4c-ae34-4002-9f0e-a969fe83465d'
const XMTP_SERVICE_ID = '9c555f0f-fb94-4a89-8b32-197f3df73ddb'

type Check = { label: string; ok: boolean; detail: string }

function protocol(): Address {
  return getAddress(resolveServerAgentCswAddress()) as Address
}

async function checkOnChain(protocolAddr: Address): Promise<Check[]> {
  const rpc = String(process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const routerRaw = String(process.env.LOTTERY_AMOE_ROUTER ?? '').trim()
  const registryRaw = String(process.env.ERC8004_AGENT_REGISTRY ?? '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432').trim()
  const agentIdRaw = String(process.env.ERC8004_AGENT_ID ?? '2205').trim()
  const agentId = Number(agentIdRaw)

  if (!/^0x[a-fA-F0-9]{40}$/.test(routerRaw)) {
    return [{ label: 'on-chain.LOTTERY_AMOE_ROUTER', ok: false, detail: 'env missing' }]
  }

  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const router = getAddress(routerRaw) as Address
  const registry = getAddress(registryRaw) as Address

  const [allowlist, ledger, nftOwner] = await Promise.all([
    client.readContract({ address: router, abi: ROUTER_ABI, functionName: 'allowlistPublisher' }),
    client.readContract({ address: router, abi: ROUTER_ABI, functionName: 'pointsLedgerPublisher' }),
    client.readContract({ address: registry, abi: IDENTITY_REGISTRY_ABI, functionName: 'ownerOf', args: [BigInt(agentId)] }),
  ])

  const expected = protocolAddr.toLowerCase()
  return [
    {
      label: 'on-chain.allowlistPublisher',
      ok: getAddress(String(allowlist)).toLowerCase() === expected,
      detail: String(allowlist),
    },
    {
      label: 'on-chain.pointsLedgerPublisher',
      ok: getAddress(String(ledger)).toLowerCase() === expected,
      detail: String(ledger),
    },
    {
      label: `on-chain.ownerOf(${agentId})`,
      ok: getAddress(String(nftOwner)).toLowerCase() === expected,
      detail: String(nftOwner),
    },
  ]
}

async function checkAgentRegistration(protocolAddr: Address): Promise<Check[]> {
  const origin = String(process.env.PROD_URL ?? 'https://4626.fun').trim().replace(/\/$/, '')
  const url = `${origin}/.well-known/agent-registration.json`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    return [{ label: 'static.agent-registration', ok: false, detail: `HTTP ${res.status} ${url}` }]
  }

  const body = await res.text()
  const lower = body.toLowerCase()
  const protocolLower = protocolAddr.toLowerCase()
  const hasProtocol = lower.includes(protocolLower.slice(2))
  const hasOperator = lower.includes('ab6d5c10b03300326cd7fab7267ae192842967b5')

  return [
    {
      label: 'static.agent-registration.protocol',
      ok: hasProtocol,
      detail: hasProtocol ? url : `missing ${protocolAddr} in ${url}`,
    },
    {
      label: 'static.agent-registration.no-operator-xmtp',
      ok: !hasOperator,
      detail: hasOperator ? 'still references operator CSW 0xAb6d5…' : 'no operator CSW in XMTP/agentWallet fields',
    },
  ]
}

async function checkRailway(protocolAddr: Address): Promise<Check[]> {
  const token = String(process.env.RAILWAY_TOKEN ?? '').trim()
  if (!token) {
    return [{ label: 'railway.env', ok: true, detail: 'skipped (RAILWAY_TOKEN unset)' }]
  }

  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query:
        'query($projectId:String!,$envId:String!,$serviceId:String!){ variables(projectId:$projectId, environmentId:$envId, serviceId:$serviceId) }',
      variables: {
        projectId: XMTP_PROJECT_ID,
        envId: XMTP_ENV_ID,
        serviceId: XMTP_SERVICE_ID,
      },
    }),
  })

  if (!res.ok) {
    return [{ label: 'railway.env', ok: false, detail: `GraphQL HTTP ${res.status}` }]
  }

  const json = (await res.json()) as { data?: { variables?: Record<string, string> }; errors?: unknown[] }
  if (json.errors?.length) {
    return [{ label: 'railway.env', ok: false, detail: 'GraphQL unauthorized or failed' }]
  }

  const vars = json.data?.variables ?? {}
  const protocolEnv = String(vars.PROTOCOL_CSW_ADDRESS ?? '').trim()
  const canonicalEnv = String(vars.CANONICAL_CSW_ADDRESS ?? '').trim()
  const privyEnv = String(vars.PROTOCOL_CSW_PRIVY_WALLET_ID ?? vars.CANONICAL_CSW_PRIVY_WALLET_ID ?? '').trim()

  return [
    {
      label: 'railway.PROTOCOL_CSW_ADDRESS',
      ok: protocolEnv.toLowerCase() === protocolAddr.toLowerCase(),
      detail: protocolEnv || '(unset)',
    },
    {
      label: 'railway.no CANONICAL_CSW_ADDRESS sender',
      ok: !canonicalEnv,
      detail: canonicalEnv || '(unset — OK)',
    },
    {
      label: 'railway.privy wallet id',
      ok: Boolean(privyEnv),
      detail: privyEnv ? `${privyEnv.slice(0, 6)}…` : '(unset)',
    },
  ]
}

async function checkKeeprHealth(): Promise<Check[]> {
  try {
    const res = await fetch('https://keepr.4626.fun/healthz')
    return [{ label: 'railway.healthz', ok: res.ok, detail: `HTTP ${res.status}` }]
  } catch (error) {
    return [{ label: 'railway.healthz', ok: false, detail: String(error instanceof Error ? error.message : error) }]
  }
}

async function main() {
  const skipRailway = process.argv.includes('--skip-railway')
  const protocolAddr = protocol()
  const policyMatch = protocolAddr.toLowerCase() === PROTOCOL_CSW_ADDRESS.toLowerCase()

  const checks: Check[] = [
    {
      label: 'policy.PROTOCOL_CSW_ADDRESS',
      ok: policyMatch,
      detail: `${protocolAddr} ${policyMatch ? 'matches policy' : `!= ${PROTOCOL_CSW_ADDRESS}`}`,
    },
    ...(await checkOnChain(protocolAddr)),
    ...(await checkAgentRegistration(protocolAddr)),
    ...(skipRailway ? [] : [...(await checkRailway(protocolAddr)), ...(await checkKeeprHealth())]),
  ]

  let failed = false
  for (const check of checks) {
    console.log(`[${check.ok ? 'OK' : 'FAIL'}] ${check.label}: ${check.detail}`)
    if (!check.ok) failed = true
  }

  if (failed) process.exit(1)
  console.log('[verify-protocol-csw-cutover] all checks passed')
}

main().catch((error) => {
  console.error(`[verify-protocol-csw-cutover] ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
