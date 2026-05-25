import type { Address } from 'viem'

export type DeployPlanDto = {
  creatorToken: Address
  deployable: boolean
  charmWeightBps: string
  ajnaWeightBps: string
  solanaWeightBps: string
  idleReserveBps: string
  reasons: {
    charm: 'paid' | 'unpaid'
    ajna: 'paid' | 'unpaid'
    solana: 'paid' | 'unpaid'
  }
  activeFeatureKeys: string[]
  blockedReason: 'no_paid_strategies' | null
}

export type ActivationDto = {
  creatorToken: Address
  featureKey: string
  status: 'pending' | 'active' | 'failed' | 'refunded'
  priceUsdcPaid: string
  paymentTxHash: string | null
  paymentVerifiedAt: string | null
  provisionedAt: string | null
  failedAt: string | null
  failureReason: string | null
  provisionerRef: string | null
  createdAt: string
  updatedAt: string
}

export type CatalogDto = {
  key: string
  displayName: string
  tagline: string
  description: string
  priceUsdc: string
  priceUsdcDisplay: string
  provisionerTag: string
  requires: readonly string[]
  estimatedActivationWindow: string
}

export type FeatureListResponse = {
  creatorToken: Address
  treasury: Address
  catalog: CatalogDto[]
  activations: ActivationDto[]
  deployPlan: DeployPlanDto
}

export type PaymentPath = 'usdc_txhash' | 'x402' | 'stripe'
