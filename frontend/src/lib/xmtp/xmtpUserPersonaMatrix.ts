import type { ConnectFlowInput, RestorePhaseOutcome, SetupPhaseOutcome } from './xmtpConnectFlow'
import type { XmtpConnectIntent } from './xmtpConnectPolicy'
import type { XmtpConnectPrecheckDenyReason, XmtpConnectPrecheckInput } from './xmtpConnectGuard'
import { evaluateXmtpConnectPrecheck } from './xmtpConnectGuard'

export type UserPersonaKind =
  | 'fresh_eoa_explicit_connect'
  | 'fresh_csw_explicit_connect'
  | 'returning_healthy_auto_restore'
  | 'returning_healthy_user_restore'
  | 'returning_uninitialized_in_place_register'
  | 'returning_registration_rejected'
  | 'returning_invalid_local_state'
  | 'passive_auto_first_visit'
  | 'restore_failed_with_install_evidence'
  | 'install_cap_hit'
  | 'opfs_lock_blocked'
  | 'preview_origin_blocked'
  | 'duplicate_connect_in_flight'
  | 'already_connected_noop'

export type UserPersonaScenario = {
  id: number
  persona: UserPersonaKind
  description: string
  precheck: XmtpConnectPrecheckInput
  flow: ConnectFlowInput | null
  expectPrecheckDenied: XmtpConnectPrecheckDenyReason | null
  /** Set only on fixed templates — variants rely on anti-churn invariants alone. */
  expectFlowConnected?: boolean
  expectNoInstallChurn: boolean
}

const CANONICAL_ORIGIN = 'https://app.4626.fun'
const PREVIEW_ORIGIN = 'https://4626-git-main-akita.vercel.app'
const NOW_MS = 1_700_000_000_000

function basePrecheck(overrides: Partial<XmtpConnectPrecheckInput> = {}): XmtpConnectPrecheckInput {
  return {
    walletAddress: '0x1234567890123456789012345678901234567890',
    walletClientReady: true,
    alreadyHasClient: false,
    connectInFlight: false,
    resetLocalStateInFlight: false,
    connectCooldownUntilMs: 0,
    nowMs: NOW_MS,
    currentOrigin: CANONICAL_ORIGIN,
    canonicalAppOrigin: CANONICAL_ORIGIN,
    hostname: 'app.4626.fun',
    ...overrides,
  }
}

function flowInput(input: ConnectFlowInput): ConnectFlowInput {
  return input
}

export const PERSONA_TEMPLATES: Array<Omit<UserPersonaScenario, 'id'>> = [
  {
    persona: 'fresh_eoa_explicit_connect',
    description: 'New Rabby/MetaMask user clicks Connect Messaging once',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: false,
      hasKnownInstallation: false,
      restoreOutcome: 'not_attempted',
      setupOutcome: 'not_reached',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: true,
    expectNoInstallChurn: true,
  },
  {
    persona: 'fresh_csw_explicit_connect',
    description: 'New canonical CSW user with Privy embedded signer',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: false,
      hasKnownInstallation: false,
      restoreOutcome: 'not_attempted',
      setupOutcome: 'not_reached',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: true,
    expectNoInstallChurn: true,
  },
  {
    persona: 'returning_healthy_auto_restore',
    description: 'Hard refresh — auto restore from OPFS without new signature',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'auto',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'success',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: true,
    expectNoInstallChurn: true,
  },
  {
    persona: 'returning_healthy_user_restore',
    description: 'Returning user opens Chats and clicks Connect Messaging',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'success',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: true,
    expectNoInstallChurn: true,
  },
  {
    persona: 'returning_uninitialized_in_place_register',
    description: 'Restored install needs one in-place identity registration',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'uninitialized_then_registered',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: true,
    expectNoInstallChurn: true,
  },
  {
    persona: 'returning_registration_rejected',
    description: 'User rejects signature — must not burn a new install',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'uninitialized_register_failed',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'returning_invalid_local_state',
    description: 'Corrupt OPFS — local reset required, no Client.create',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'invalid_local',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'passive_auto_first_visit',
    description: 'Auto-connect on first visit must not create without user click',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'auto',
      opfsDatabaseExists: false,
      hasKnownInstallation: false,
      restoreOutcome: 'not_attempted',
      setupOutcome: 'not_reached',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'restore_failed_with_install_evidence',
    description: 'Restore fails but install markers exist — refuse create',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'auto',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'failed',
      setupOutcome: 'not_reached',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'install_cap_hit',
    description: '10/10 installation cap — no create churn',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'installation_limit',
      setupOutcome: 'not_reached',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'opfs_lock_blocked',
    description: 'OPFS locked in same profile — refuse create',
    precheck: basePrecheck(),
    flow: flowInput({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'opfs_lock',
      setupOutcome: 'not_reached',
    }),
    expectPrecheckDenied: null,
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'preview_origin_blocked',
    description: 'Vercel preview host must not create installations',
    precheck: basePrecheck({
      currentOrigin: PREVIEW_ORIGIN,
      hostname: '4626-git-main-akita.vercel.app',
    }),
    flow: null,
    expectPrecheckDenied: 'wrong_origin',
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'duplicate_connect_in_flight',
    description: 'Double-click Connect Messaging — second call is ignored',
    precheck: basePrecheck({ connectInFlight: true }),
    flow: null,
    expectPrecheckDenied: 'connect_in_flight',
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
  {
    persona: 'already_connected_noop',
    description: 'Connected client — connect is a no-op',
    precheck: basePrecheck({ alreadyHasClient: true }),
    flow: null,
    expectPrecheckDenied: 'already_connected',
    expectFlowConnected: false,
    expectNoInstallChurn: true,
  },
]

const INTENT_VARIANTS: XmtpConnectIntent[] = ['auto', 'user']
const RESTORE_VARIANTS: RestorePhaseOutcome[] = [
  'not_attempted',
  'success',
  'failed',
  'installation_limit',
  'opfs_lock',
]
const SETUP_VARIANTS: SetupPhaseOutcome[] = [
  'not_reached',
  'success',
  'invalid_local',
  'uninitialized_then_registered',
  'uninitialized_register_failed',
  'transient_then_success',
  'transient_then_failed',
]

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

/** Deterministic multi-user scenarios for high-volume regression (default 1000). */
export function buildUserPersonaScenarioMatrix(count = 1000): UserPersonaScenario[] {
  const scenarios: UserPersonaScenario[] = []

  for (const template of PERSONA_TEMPLATES) {
    scenarios.push({
      id: scenarios.length,
      ...template,
    })
  }

  const rng = mulberry32(4626)
  while (scenarios.length < count) {
    const template = pick(rng, PERSONA_TEMPLATES)
    const intent = pick(rng, INTENT_VARIANTS)
    const opfsDatabaseExists = rng() > 0.45
    const hasKnownInstallation = opfsDatabaseExists ? rng() > 0.2 : rng() > 0.85
    const restoreOutcome = pick(rng, RESTORE_VARIANTS)
    const setupOutcome = restoreOutcome === 'success' ? pick(rng, SETUP_VARIANTS) : 'not_reached'

    const hostnameRoll = rng()
    const usePreview = hostnameRoll > 0.92
    const useLocalhost = !usePreview && hostnameRoll > 0.88

    const precheck = basePrecheck({
      connectInFlight: rng() > 0.96,
      alreadyHasClient: rng() > 0.97,
      resetLocalStateInFlight: rng() > 0.98,
      connectCooldownUntilMs: rng() > 0.985 ? NOW_MS + 30_000 : 0,
      currentOrigin: usePreview ? PREVIEW_ORIGIN : useLocalhost ? 'http://localhost:5173' : CANONICAL_ORIGIN,
      hostname: usePreview
        ? '4626-git-main-akita.vercel.app'
        : useLocalhost
          ? 'localhost'
          : 'app.4626.fun',
    })

    const precheckResult = evaluateXmtpConnectPrecheck(precheck)
    const precheckDenied = precheckResult.allowed ? null : precheckResult.reason

    scenarios.push({
      id: scenarios.length,
      persona: template.persona,
      description: `${template.description} (variant ${scenarios.length})`,
      precheck,
      flow:
        precheckDenied === null
          ? flowInput({
              intent,
              opfsDatabaseExists,
              hasKnownInstallation,
              restoreOutcome,
              setupOutcome,
            })
          : null,
      expectPrecheckDenied: precheckDenied,
      expectNoInstallChurn: true,
    })
  }

  return scenarios.slice(0, count)
}
