import { formatEther } from 'viem'

export type RelayPreviewShape = {
  relay?: {
    userCall?: { value?: string | bigint | null }
    paymentDetails?: { amount?: string | null } | null
  } | null
  preflight?: {
    alreadyOwner?: boolean
    simulation?: {
      ok?: boolean
    }
    relayQuoteError?: string | null
    relayDepositSimulation?: {
      ok?: boolean
      error?: string | null
    } | null
    relayQuoteDiagnostics?: {
      paymentDetails?: { amount?: string | null } | null
      userTransaction?: { value?: string | null } | null
    } | null
  } | null
} | null

export type RelayFlowStepStatus = 'pending' | 'blocked' | 'ready' | 'done'

function relayDepositSimulationBlocks(preview: RelayPreviewShape): boolean {
  return preview?.preflight?.relayDepositSimulation?.ok === false
}

/** Relay-only owner mutations can proceed when the quote + deposit preflight pass. */
function relayPreviewIsActionable(preview: RelayPreviewShape): boolean {
  if (!preview?.relay) return false
  if (relayDepositSimulationBlocks(preview)) return false
  return resolveRelayRequiredDepositWei(preview) !== null
}

export function resolveRelayPreviewBlockReason(preview: RelayPreviewShape): string | null {
  if (!preview) return null
  if (preview.preflight?.alreadyOwner) return null
  if (preview.preflight?.relayQuoteError?.trim()) {
    return preview.preflight.relayQuoteError.trim()
  }
  if (relayDepositSimulationBlocks(preview)) {
    return (
      preview.preflight?.relayDepositSimulation?.error?.trim() ??
      'Relay deposit preflight failed. Fund the smart wallet on Base Mainnet and rebuild preview.'
    )
  }
  if (!preview.relay) {
    return 'Relay quote is missing. Rebuild preview after confirming Base Mainnet and wallet funding.'
  }
  if (resolveRelayRequiredDepositWei(preview) === null) {
    return 'Relay deposit amount could not be parsed from the quote. Rebuild preview.'
  }
  if (preview.preflight?.simulation?.ok !== true) {
    const simulationError = preview.preflight?.simulation?.error?.trim()
    return simulationError
      ? `Add-owner calldata simulation failed: ${simulationError}`
      : 'Add-owner calldata simulation did not pass.'
  }
  return null
}

export function resolveRelayPreviewStepOneStatus(params: {
  previewLoading: boolean
  preview: RelayPreviewShape
}): RelayFlowStepStatus {
  if (params.previewLoading) return 'pending'
  if (!params.preview) return 'pending'
  if (params.preview.preflight?.alreadyOwner) return 'done'
  if (relayPreviewIsActionable(params.preview)) return 'done'
  if (params.preview.preflight?.relayQuoteError) return 'blocked'
  if (relayDepositSimulationBlocks(params.preview)) return 'blocked'
  if (!params.preview.relay) return 'blocked'
  if (resolveRelayRequiredDepositWei(params.preview) === null) return 'blocked'
  if (params.preview.preflight?.simulation?.ok !== true) return 'blocked'
  return 'done'
}

export function resolveRelaySubmitStepTwoStatus(params: {
  stepOne: RelayFlowStepStatus
  txHash: string | null
  busy: boolean
}): RelayFlowStepStatus {
  if (params.txHash) return 'done'
  if (params.stepOne !== 'done') return 'blocked'
  if (params.busy) return 'ready'
  return 'ready'
}

export function relayFlowStepStatusClass(status: RelayFlowStepStatus): string {
  return status === 'pending' || status === 'blocked' ? 'text-zinc-500' : 'text-emerald-300'
}

export function resolveOwnerMutationPhase(params: {
  stepOne: RelayFlowStepStatus
  stepTwo: RelayFlowStepStatus
  alreadyComplete?: boolean
}): 'preview' | 'submit' | 'complete' {
  if (params.alreadyComplete || params.stepTwo === 'done') return 'complete'
  if (params.stepOne === 'done') return 'submit'
  return 'preview'
}

export function relayFlowStepStatusLabel(status: RelayFlowStepStatus): string {
  switch (status) {
    case 'pending':
      return 'pending'
    case 'blocked':
      return 'blocked'
    case 'ready':
      return 'ready'
    case 'done':
      return 'done'
  }
}

export function resolveRelayRequiredDepositWei(preview: RelayPreviewShape): bigint | null {
  if (!preview?.relay) return null
  const amount = preview.relay.paymentDetails?.amount
  if (typeof amount === 'string' && /^[1-9][0-9]*$/.test(amount)) {
    return BigInt(amount)
  }
  const quotedUserValue = preview.relay.userCall?.value
  if (typeof quotedUserValue === 'string' && /^0x[0-9a-fA-F]+$/.test(quotedUserValue)) {
    const wei = BigInt(quotedUserValue)
    return wei > 0n ? wei : null
  }
  if (typeof quotedUserValue === 'string' && /^[1-9][0-9]*$/.test(quotedUserValue)) {
    return BigInt(quotedUserValue)
  }
  return null
}

export function formatRelayDepositEth(requiredDepositWei: bigint): string {
  const raw = formatEther(requiredDepositWei)
  const parts = raw.split('.')
  const whole = parts[0] ?? '0'
  const fraction = parts[1] ?? ''
  const trimmed = fraction.replace(/0+$/, '').slice(0, 8)
  return trimmed ? `${whole}.${trimmed}` : whole
}
