/**
 * Canonical pre-submit gate for Solana B2 lottery entries.
 *
 * A row cannot enter `submitting` until this gate proves the event mint is the
 * unique applied Token-2022 hook route, the venue is ready, and the buyer maps
 * to one parent CSW. Personal coverage remains forced to zero.
 */

import { verifySolanaB2Readiness } from './solanaB2Readiness.js'
import {
  markInboxIdentity,
  type SolanaLotteryInboxRow,
} from './solanaLotteryEntryInbox.js'
import { resolveSolanaLotteryBeneficiary } from './solanaLotteryIdentity.js'
import { resolveAppliedSolanaShareMeshMappingByMint } from './solanaShareMeshMappings.js'
import { readSolanaCreatorRelayConfigByShareMeshMint } from './solanaCreatorRelayConfig.js'
import { consumeSolanaB2CanaryAuthorization } from './solanaB2CanaryAuthorization.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export async function prepareSolanaLotteryInboxForSubmit(params: {
  db: Db
  row: SolanaLotteryInboxRow
  leaseOwner: string
  amountScaled: string
}): Promise<SolanaLotteryInboxRow> {
  if (params.row.status !== 'leased' || params.row.instructionKind !== 'buy_path') {
    throw new Error('solana_lottery_inbox_not_submit_ready')
  }
  if (!/^[1-9][0-9]*$/.test(params.amountScaled)) {
    throw new Error('solana_lottery_invalid_scaled_amount')
  }

  const mapping = await resolveAppliedSolanaShareMeshMappingByMint({
    db: params.db,
    shareMeshMint: params.row.creatorMint,
  })
  if (!mapping) throw new Error('solana_lottery_b2_mapping_missing')

  const relayConfig = await readSolanaCreatorRelayConfigByShareMeshMint({
    db: params.db,
    shareMeshMint: params.row.creatorMint,
  })
  const productionRelayEnabled = relayConfig?.relayEnabled === true && relayConfig.readinessStatus === 'verified'

  const readiness = await verifySolanaB2Readiness({
    db: params.db,
    creatorToken: mapping.creatorToken,
    shareMeshMint: params.row.creatorMint,
  })
  if (
    !readiness.ready ||
    readiness.shareMeshMint !== params.row.creatorMint ||
    readiness.shareOft.toLowerCase() !== mapping.shareOft.toLowerCase()
  ) {
    throw new Error('solana_lottery_b2_route_not_ready')
  }

  const identity = await resolveSolanaLotteryBeneficiary({
    db: params.db,
    buyerSolana: params.row.buyerSolana,
  })
  if (!identity.ok) {
    throw new Error(`solana_lottery_identity_${identity.reason}`)
  }

  let canaryAuthorized = false
  if (!productionRelayEnabled) {
    canaryAuthorized = await consumeSolanaB2CanaryAuthorization({
      db: params.db,
      sourceEventId: params.row.sourceEventId,
      shareMeshMint: params.row.creatorMint,
    })
    if (!canaryAuthorized) throw new Error('solana_lottery_creator_relay_disabled')
  }

  const marked = await markInboxIdentity({
    db: params.db,
    id: params.row.id,
    beneficiaryCsw: identity.beneficiaryCsw,
    profileId: identity.profileId,
    shareOft: mapping.shareOft,
    amountScaled: params.amountScaled,
    leaseOwner: params.leaseOwner,
  })
  return canaryAuthorized ? { ...marked, canaryAuthorized: true } : marked
}
