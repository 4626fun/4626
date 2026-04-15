import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = [
  'TEE_ENFORCEMENT_ENABLED',
  'TEE_ENFORCEMENT_FAIL_OPEN',
  'TEE_VALIDATOR_ADDRESSES',
  'TEE_VALIDATION_TAG',
  'TEE_MIN_VALIDATION_COUNT',
  'TEE_MIN_AVG_RESPONSE',
  'TEE_VALIDATION_CACHE_TTL_MS',
  'ERC8004_VALIDATION_REGISTRY',
  'ERC8004_AGENT_ID',
]

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

describe('teeAttestationGate', () => {
  beforeEach(() => {
    vi.resetModules()
    clearEnv()
  })

  afterEach(() => {
    clearEnv()
  })

  it('returns pass-through status when enforcement is disabled', async () => {
    const { getTeeAttestationStatus } = await import('../agent/teeAttestationGate.ts')
    const status = await getTeeAttestationStatus()
    expect(status.enabled).toBe(false)
    expect(status.passed).toBe(true)
    expect(status.reason).toBe('tee_enforcement_disabled')
  })

  it('fails closed when enforcement is enabled but configuration is missing', async () => {
    process.env.TEE_ENFORCEMENT_ENABLED = 'true'
    process.env.TEE_ENFORCEMENT_FAIL_OPEN = 'false'

    const { assertTeeAttestationOrThrow, getTeeAttestationStatus } = await import('../agent/teeAttestationGate.ts')
    const status = await getTeeAttestationStatus()
    expect(status.enabled).toBe(true)
    expect(status.passed).toBe(false)
    expect(status.reason).toBe('tee_validation_config_missing')

    await expect(
      assertTeeAttestationOrThrow({
        action: 'test:privileged_action',
      }),
    ).rejects.toThrow('TEE_ATTESTATION_REQUIRED')
  })

  it('allows actions when fail-open is enabled and verifier config is missing', async () => {
    process.env.TEE_ENFORCEMENT_ENABLED = 'true'
    process.env.TEE_ENFORCEMENT_FAIL_OPEN = 'true'

    const { assertTeeAttestationOrThrow, getTeeAttestationStatus } = await import('../agent/teeAttestationGate.ts')
    const status = await getTeeAttestationStatus()
    expect(status.enabled).toBe(true)
    expect(status.passed).toBe(true)
    expect(status.reason).toBe('tee_validation_config_missing')

    await expect(assertTeeAttestationOrThrow()).resolves.toBeUndefined()
  })
})
