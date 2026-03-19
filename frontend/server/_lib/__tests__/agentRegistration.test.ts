import { afterEach, describe, expect, it } from 'vitest'

import { buildAgentRegistration } from '../agentRegistration.js'

const ENV_KEYS = [
  'ERC8004_AGENT_REGISTRATION_JSON',
  'ERC8004_AGENT_REGISTRY',
  'ERC8004_AGENT_CHAIN_ID',
  'ERC8004_AGENT_ID',
] as const

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
})
