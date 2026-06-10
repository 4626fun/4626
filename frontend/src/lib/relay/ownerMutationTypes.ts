/** One EIP-5792 call. Shape matches backend preview responses. */
export type OwnerMutationEip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

/** Relay-orchestrated submission metadata for owner mutations. */
export type OwnerMutationRelayFlow = {
  requestId: `0x${string}`
  orderId: `0x${string}` | null
  paymentDetails: {
    chainId: number | null
    depository: `0x${string}`
    currency: `0x${string}`
    amount: string
  } | null
  userCall: OwnerMutationEip5792Call
  feeUsd: string | null
}

export type OwnerMutationRelayQuoteDiagnostics = {
  requestId: `0x${string}` | null
  orderId: `0x${string}` | null
  paymentDetails: {
    chainId: number | null
    depository: `0x${string}` | null
    currency: `0x${string}` | null
    amount: string | null
  } | null
  userTransaction: {
    to: `0x${string}`
    value: string
    chainId: number
    dataSelector: string | null
  } | null
  feeUsd: string | null
  rawSnippet: string | null
}

export type OwnerMutationRelayDepositSimulation = {
  ok: boolean
  error: string | null
  funderBalanceWei: string
  depositWei: string
  gasBufferWei: string
}

export type OwnerMutationPreviewBase = {
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  calls: OwnerMutationEip5792Call[]
  relay: OwnerMutationRelayFlow | null
  preflight: {
    relayQuoteError: string | null
    relayDepositSimulation: OwnerMutationRelayDepositSimulation | null
    relayQuoteDiagnostics: OwnerMutationRelayQuoteDiagnostics | null
    simulation: {
      ok: boolean
      error: string | null
    }
  }
}
