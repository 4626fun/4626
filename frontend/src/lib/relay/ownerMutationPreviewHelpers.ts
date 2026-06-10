import { formatEther } from 'viem'

export type RelayPreviewShape = {
  txRequest?: {
    to?: `0x${string}`
  }
  relay?: {
    userCall?: { value?: string | bigint | null }
    paymentDetails?: { amount?: string | null } | null
    feeUsd?: string | null
  } | null
  preflight?: {
    alreadyOwner?: boolean
    simulation?: {
      ok?: boolean
      error?: string | null
    }
    relayQuoteError?: string | null
    relayDepositSimulation?: {
      ok?: boolean
      error?: string | null
      funderBalanceWei?: string
      depositWei?: string
      gasBufferWei?: string
    } | null
    relayQuoteDiagnostics?: {
      paymentDetails?: { amount?: string | null } | null
      userTransaction?: { value?: string | null } | null
      feeUsd?: string | null
    } | null
  } | null
} | null

export type RelayFundingShortfall = {
  funderAddress: `0x${string}` | null
  balanceWei: bigint
  depositWei: bigint
  gasBufferWei: bigint
  /** Minimum native ETH on the CSW for Relay Part 1 depositNative. */
  requiredNativeWei: bigint
  /** deposit + gas buffer — conservative send target on Base. */
  recommendedTopUpWei: bigint
  shortfallWei: bigint
}

function parseNonNegativeWeiField(value: string | undefined | null): bigint | null {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function parsePositiveWeiField(value: string | undefined | null): bigint | null {
  const parsed = parseNonNegativeWeiField(value)
  return parsed !== null && parsed > 0n ? parsed : null
}

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
  /** True only after Relay Part 2 + on-chain mutation verification succeed. */
  flowComplete?: boolean
  /** Part 1 deposit landed but Relay Part 2 is still pending. */
  waitingForRelayFill?: boolean
}): RelayFlowStepStatus {
  if (params.flowComplete) return 'done'
  if (params.waitingForRelayFill) return 'ready'
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
  flowComplete?: boolean
  waitingForRelayFill?: boolean
}): 'preview' | 'submit' | 'waiting' | 'complete' {
  if (params.alreadyComplete || params.flowComplete || params.stepTwo === 'done') return 'complete'
  if (params.waitingForRelayFill) return 'waiting'
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
    if (wei > 0n) return wei
  }
  if (typeof quotedUserValue === 'string' && /^[1-9][0-9]*$/.test(quotedUserValue)) {
    return BigInt(quotedUserValue)
  }
  const simDeposit = parsePositiveWeiField(preview.preflight?.relayDepositSimulation?.depositWei)
  if (simDeposit !== null) return simDeposit
  const diagnosticAmount = preview.preflight?.relayQuoteDiagnostics?.paymentDetails?.amount
  if (typeof diagnosticAmount === 'string' && /^[1-9][0-9]*$/.test(diagnosticAmount)) {
    return BigInt(diagnosticAmount)
  }
  return null
}

/** When deposit preflight fails for insufficient native balance, return funding targets. */
export function resolveRelayFundingShortfall(preview: RelayPreviewShape): RelayFundingShortfall | null {
  const sim = preview?.preflight?.relayDepositSimulation
  if (!sim || sim.ok !== false) return null

  const depositWei = parsePositiveWeiField(sim.depositWei)
  if (depositWei === null) return null

  const gasBufferWei = parseNonNegativeWeiField(sim.gasBufferWei) ?? 0n
  const balanceWei = parseNonNegativeWeiField(sim.funderBalanceWei) ?? 0n
  const recommendedTopUpWei = depositWei + gasBufferWei
  const shortfallWei = recommendedTopUpWei > balanceWei ? recommendedTopUpWei - balanceWei : 0n
  if (shortfallWei <= 0n) return null

  const errorText = [sim.error, preview.preflight?.relayQuoteError].filter(Boolean).join(' ')
  const addressMatch = errorText.match(/Fund (0x[a-fA-F0-9]{40})/)
  const funderAddress =
    (addressMatch?.[1] as `0x${string}` | undefined) ??
    preview.txRequest?.to ??
    null

  return {
    funderAddress,
    balanceWei,
    depositWei,
    gasBufferWei,
    requiredNativeWei: depositWei,
    recommendedTopUpWei,
    shortfallWei,
  }
}

export function formatRelayDepositEth(requiredDepositWei: bigint): string {
  const raw = formatEther(requiredDepositWei)
  const parts = raw.split('.')
  const whole = parts[0] ?? '0'
  const fraction = parts[1] ?? ''
  const trimmed = fraction.replace(/0+$/, '').slice(0, 8)
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** Relay solver gas-fee estimate in USD (informational — not the Part 1 native deposit). */
export function resolveRelayFeeUsd(preview: RelayPreviewShape): string | null {
  const raw = preview?.relay?.feeUsd ?? preview?.preflight?.relayQuoteDiagnostics?.feeUsd ?? null
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}
