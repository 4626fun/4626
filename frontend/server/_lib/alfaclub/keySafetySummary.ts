import {
  evaluateKeyDefense,
  type KeyDefenseEvaluation,
} from '../../../src/lib/alfaclub/keyDefense.js'
import { resolveKeySafetyRoomContext } from './keySafetyRoomContext.js'

export type AlfaClubKeySafetyStatus = 'safe' | 'caution' | 'at-risk'

export function resolveKeySafetyStatus(
  evaluation: KeyDefenseEvaluation,
  potAtRiskUsdc: number,
): AlfaClubKeySafetyStatus {
  if (!evaluation.raid.raidUnprofitable) return 'at-risk'
  const nearThreshold =
    Number.isFinite(evaluation.maxSafePotUsdc) &&
    evaluation.maxSafePotUsdc > 0 &&
    potAtRiskUsdc / evaluation.maxSafePotUsdc >= 0.75
  return nearThreshold || !evaluation.hasVeto ? 'caution' : 'safe'
}

export async function resolveAlfaClubKeySafetySummary(
  roomId: string,
): Promise<{ status: AlfaClubKeySafetyStatus } | null> {
  const context = await resolveKeySafetyRoomContext(roomId)
  const keySupply = context?.keySupply ?? 0
  if (!context || keySupply <= 0) return null
  const potAtRiskUsdc = context.attackModelPotUsdc ?? context.feeBaselinePotUsdc ?? 0
  const evaluation = evaluateKeyDefense({
    roomType: context.roomType ?? 'trading',
    roomTier: context.tier ?? 'club',
    keySupply,
    yourKeys: context.hostKeys,
    potUsdc: potAtRiskUsdc,
    donationUsdc: 0,
    targetRecoveryFraction: 0.5,
  })
  return { status: resolveKeySafetyStatus(evaluation, potAtRiskUsdc) }
}
