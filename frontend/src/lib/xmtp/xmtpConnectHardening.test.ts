// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { normalizeScenario, simulateXmtpConnectFlow } from './xmtpConnectFlow'
import {
  buildWrongOriginConnectError,
  evaluateXmtpConnectPrecheck,
  isCanonicalMessagingOrigin,
  isLocalDevHostname,
} from './xmtpConnectGuard'
import { buildUserPersonaScenarioMatrix, PERSONA_TEMPLATES } from './xmtpUserPersonaMatrix'

const PERSONA_SCENARIOS = buildUserPersonaScenarioMatrix(1000)

function assertAntiChurnForPersona(
  flow: ReturnType<typeof normalizeScenario>,
  trace: ReturnType<typeof simulateXmtpConnectFlow>,
): void {
  const hasInstallEvidence = flow.opfsDatabaseExists || flow.hasKnownInstallation

  expect(trace.clientCreateCount).toBeLessThanOrEqual(1)

  if (hasInstallEvidence) {
    expect(trace.clientCreateCount).toBe(0)
  }

  if (!hasInstallEvidence && flow.intent === 'auto') {
    expect(trace.clientCreateCount).toBe(0)
  }

  if (trace.clientCreateCount === 1) {
    expect(flow.intent).toBe('user')
    expect(flow.opfsDatabaseExists).toBe(false)
    expect(flow.hasKnownInstallation).toBe(false)
  }

  if (trace.refusedChurn) {
    expect(trace.clientCreateCount).toBe(0)
  }
}

describe('xmtpConnectGuard', () => {
  const now = 1_700_000_000_000
  const canonical = 'https://app.4626.fun'

  it('allows canonical production origin with wallet ready', () => {
    expect(
      evaluateXmtpConnectPrecheck({
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletClientReady: true,
        alreadyHasClient: false,
        connectInFlight: false,
        resetLocalStateInFlight: false,
        connectCooldownUntilMs: 0,
        nowMs: now,
        currentOrigin: canonical,
        canonicalAppOrigin: canonical,
        hostname: 'app.4626.fun',
      }),
    ).toEqual({ allowed: true })
  })

  it('allows marketing waitlist origin for XMTP connect', () => {
    expect(
      evaluateXmtpConnectPrecheck({
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletClientReady: true,
        alreadyHasClient: false,
        connectInFlight: false,
        resetLocalStateInFlight: false,
        connectCooldownUntilMs: 0,
        nowMs: now,
        currentOrigin: 'https://4626.fun',
        canonicalAppOrigin: canonical,
        hostname: '4626.fun',
      }),
    ).toEqual({ allowed: true })
  })

  it('blocks preview deployments to prevent install churn', () => {
    const result = evaluateXmtpConnectPrecheck({
      walletAddress: '0x1234567890123456789012345678901234567890',
      walletClientReady: true,
      alreadyHasClient: false,
      connectInFlight: false,
      resetLocalStateInFlight: false,
      connectCooldownUntilMs: 0,
      nowMs: now,
      currentOrigin: 'https://4626-git-main-akita.vercel.app',
      canonicalAppOrigin: canonical,
      hostname: '4626-git-main-akita.vercel.app',
    })
    expect(result).toEqual({ allowed: false, reason: 'wrong_origin' })
  })

  it('allows localhost dev origins', () => {
    expect(
      isCanonicalMessagingOrigin({
        currentOrigin: 'http://localhost:5173',
        canonicalAppOrigin: canonical,
        hostname: 'localhost',
      }),
    ).toBe(true)
    expect(isLocalDevHostname('127.0.0.1')).toBe(true)
  })

  it('dedupes duplicate connect attempts', () => {
    expect(
      evaluateXmtpConnectPrecheck({
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletClientReady: true,
        alreadyHasClient: false,
        connectInFlight: true,
        resetLocalStateInFlight: false,
        connectCooldownUntilMs: 0,
        nowMs: now,
        currentOrigin: canonical,
        canonicalAppOrigin: canonical,
        hostname: 'app.4626.fun',
      }),
    ).toEqual({ allowed: false, reason: 'connect_in_flight' })
  })

  it('builds actionable wrong-origin copy', () => {
    expect(buildWrongOriginConnectError('https://preview.example', canonical)).toContain(
      'Messaging is disabled on https://preview.example',
    )
    expect(buildWrongOriginConnectError('https://preview.example', canonical)).toContain(canonical)
  })
})

describe('xmtp multi-user persona matrix', () => {
  it('includes all canonical persona templates', () => {
    expect(PERSONA_TEMPLATES.length).toBeGreaterThanOrEqual(10)
    for (const template of PERSONA_TEMPLATES) {
      expect(template.persona.length).toBeGreaterThan(0)
    }
  })

  it('generates exactly 1000 persona scenarios', () => {
    expect(PERSONA_SCENARIOS).toHaveLength(1000)
  })
})

describe.each(PERSONA_SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
  'xmtp user persona #%i',
  (_id, scenario) => {
    it('passes preflight guards and anti-churn flow rules for other users', () => {
      const precheck = evaluateXmtpConnectPrecheck(scenario.precheck)

      if (scenario.expectPrecheckDenied) {
        expect(precheck.allowed).toBe(false)
        if (!precheck.allowed) {
          expect(precheck.reason).toBe(scenario.expectPrecheckDenied)
        }
        return
      }

      expect(precheck.allowed).toBe(true)

      if (!scenario.flow) return

      const normalized = normalizeScenario(scenario.flow)
      const trace = simulateXmtpConnectFlow(normalized)
      assertAntiChurnForPersona(normalized, trace)

      if (typeof scenario.expectFlowConnected === 'boolean') {
        if (scenario.expectFlowConnected) {
          expect(trace.outcome).toBe('connected')
        } else {
          expect(trace.outcome).not.toBe('connected')
        }
      }
    })
  },
)
