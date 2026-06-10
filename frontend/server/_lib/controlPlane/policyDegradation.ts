import type { ControlPlaneVerb, DegradationMode } from './policy.js'
import { loadControlPlanePolicy } from './policy.js'

export type DegradationContext = {
  hasDeploySession?: boolean
  hasKeeprVault?: boolean
  isStale?: boolean
}

export function resolveDegradationMode(verb: ControlPlaneVerb): DegradationMode {
  return loadControlPlanePolicy().policy.degradation[verb]
}

export function getStaleThresholdMinutes(): number {
  const raw = Number(process.env.CONTROL_PLANE_STALE_MINUTES ?? 15)
  if (!Number.isFinite(raw)) return 15
  return Math.min(24 * 60, Math.max(1, Math.floor(raw)))
}

export function evaluateFreshness(lastUpdatedAt: string | null | undefined): {
  freshness: 'fresh' | 'stale'
  ageMinutes: number | null
} {
  if (!lastUpdatedAt) return { freshness: 'stale', ageMinutes: null }
  const updatedMs = Date.parse(lastUpdatedAt)
  if (!Number.isFinite(updatedMs)) return { freshness: 'stale', ageMinutes: null }
  const ageMinutes = Math.floor((Date.now() - updatedMs) / 60_000)
  const threshold = getStaleThresholdMinutes()
  return {
    freshness: ageMinutes > threshold ? 'stale' : 'fresh',
    ageMinutes,
  }
}

export function enforceMutatingDegradation(params: {
  verb: ControlPlaneVerb
  context: DegradationContext
}): { blocked: boolean; mode: DegradationMode; message?: string } {
  const mode = resolveDegradationMode(params.verb)
  if (
    params.verb !== 'provisionVaultEconomy' &&
    params.verb !== 'getVaultLifecycleStatus' &&
    !params.context.hasKeeprVault
  ) {
    return {
      blocked: true,
      mode,
      message: 'vault_not_found_in_keepr_registry',
    }
  }
  if (mode === 'fail_closed') {
    if (params.verb === 'provisionVaultEconomy' && !params.context.hasDeploySession) {
      return {
        blocked: true,
        mode,
        message: 'provision_requires_completed_deploy_session',
      }
    }
  }
  if (mode === 'block_until_operator') {
    return {
      blocked: true,
      mode,
      message: 'operation_blocked_until_operator_review',
    }
  }
  return { blocked: false, mode }
}
