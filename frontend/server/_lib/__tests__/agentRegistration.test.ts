import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildAgentRegistration } from '../agentRegistration.js'

const ENV_KEYS = [
  'ERC8004_AGENT_REGISTRATION_JSON',
  'ERC8004_AGENT_REGISTRY',
  'ERC8004_AGENT_CHAIN_ID',
  'ERC8004_AGENT_ID',
  'ERC8004_REPUTATION_REGISTRY',
  'XMTP_AGENT_CSW_ADDRESS',
] as const

const STATIC_REGISTRATION_PATH = path.resolve(process.cwd(), 'public/.well-known/agent-registration.json')
const CANONICAL_AGENT_WALLET = 'eip155:8453:0xab6d5c10b03300326cd7fab7267ae192842967b5'
const CANONICAL_REGISTRY = 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
const CANONICAL_REPUTATION_REGISTRY = 'eip155:8453:0x8004baa17c55a88189ae136b182e5fda19de9b63'
const CANONICAL_AGENT_WALLET_EXPLORER = 'https://basescan.org/address/0xab6d5c10b03300326cd7fab7267ae192842967b5'

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  (typeof ENV_KEYS)[number],
  string | undefined
>

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (typeof value === 'string') process.env[key] = value
    else delete process.env[key]
  }
}

afterEach(() => {
  restoreEnv()
})

describe('buildAgentRegistration', () => {
  it('does not default missing ERC8004_AGENT_ID to 0', () => {
    process.env.ERC8004_AGENT_REGISTRATION_JSON = JSON.stringify({
      name: 'Test Agent',
      registrations: [],
      services: [{ name: 'api', endpoint: '/api/v1/spec.json' }],
    })
    process.env.ERC8004_AGENT_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
    process.env.ERC8004_AGENT_CHAIN_ID = '8453'
    delete process.env.ERC8004_AGENT_ID

    const result = buildAgentRegistration('https://4626.fun')
    expect(result.payload).toBeUndefined()
    expect(result.missing).toContain('ERC8004_AGENT_ID')
  })

  it('accepts explicit ERC8004_AGENT_ID=0', () => {
    process.env.ERC8004_AGENT_REGISTRATION_JSON = JSON.stringify({
      name: 'Test Agent',
      registrations: [],
      services: [{ name: 'api', endpoint: '/api/v1/spec.json' }],
    })
    process.env.ERC8004_AGENT_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
    process.env.ERC8004_AGENT_CHAIN_ID = '8453'
    process.env.ERC8004_AGENT_ID = '0'

    const result = buildAgentRegistration('https://4626.fun')
    expect(result.payload).toBeDefined()
    expect(result.payload?.registrations?.[0]?.agentId).toBe(0)
  })

  it('stays aligned with the checked-in public registration mirror for agent 2205', () => {
    delete process.env.ERC8004_AGENT_REGISTRATION_JSON
    delete process.env.ERC8004_AGENT_REGISTRY
    delete process.env.ERC8004_AGENT_CHAIN_ID
    delete process.env.ERC8004_AGENT_ID
    delete process.env.ERC8004_REPUTATION_REGISTRY
    delete process.env.XMTP_AGENT_CSW_ADDRESS

    const staticRegistration = JSON.parse(fs.readFileSync(STATIC_REGISTRATION_PATH, 'utf8')) as {
      registrations?: Array<{ agentId?: number; agentRegistry?: string }>
      reputationRegistry?: string
      services?: Array<Record<string, unknown>>
    }
    const result = buildAgentRegistration('https://4626.fun')

    const dynamicAgentWallet = result.payload?.services?.find((service) => service.name === 'agentWallet')
    const staticAgentWallet = staticRegistration.services?.find((service) => String(service?.name ?? '') === 'agentWallet')

    expect(result.payload).toBeDefined()
    expect(result.payload).toMatchObject({
      name: '4626 Agent',
      registrations: [{ agentId: 2205, agentRegistry: CANONICAL_REGISTRY }],
      reputationRegistry: CANONICAL_REPUTATION_REGISTRY,
      supportedTrust: ['reputation', 'crypto-economic', 'tee-attestation'],
    })
    expect(dynamicAgentWallet).toMatchObject({
      endpoint: CANONICAL_AGENT_WALLET,
      account: CANONICAL_AGENT_WALLET,
      explorer: CANONICAL_AGENT_WALLET_EXPLORER,
    })

    expect(staticRegistration).toMatchObject({
      name: '4626 Agent',
      registrations: [{ agentId: 2205, agentRegistry: CANONICAL_REGISTRY }],
      reputationRegistry: CANONICAL_REPUTATION_REGISTRY,
      supportedTrust: ['reputation', 'crypto-economic', 'tee-attestation'],
    })
    expect(staticAgentWallet).toMatchObject({
      endpoint: CANONICAL_AGENT_WALLET,
      account: CANONICAL_AGENT_WALLET,
      explorer: CANONICAL_AGENT_WALLET_EXPLORER,
    })
  })
})
