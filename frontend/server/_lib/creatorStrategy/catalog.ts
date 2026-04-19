/**
 * Creator strategy feature catalog.
 *
 * Every productive strategy on a `CreatorOVault` (Charm, Ajna, Solana
 * bridge) is a paid, per-creator feature gated by an activation in
 * `creator_strategy_features`. There is no free baseline — a creator
 * must activate at least one feature before Phase 3 deploy, and each
 * feature entry in this catalog is independently priced in USDC.
 *
 * Activation is a one-time USDC payment on Base that unlocks
 * server-side provisioning of the underlying infra. See
 * `docs/operations/creator-strategy-features.md` for the full product
 * model (deploy-gating vs post-deploy features, weight scaling, etc.).
 *
 * Design rules (keep this file boring and declarative):
 *   - Prices are in USDC base units (6 decimals). 100e6 = $100.
 *   - Keys are kebab_case + provider-scoped so we can add more without
 *     namespace collisions (e.g. `solana_meteora_alpha_vault`,
 *     `charm_auto_rebalance`, `ajna_min_bucket_keeper`).
 *   - `provisionerTag` is a free-form string the operator / automation
 *     uses to pick which script / workflow to run. The catalog does NOT
 *     embed provisioning logic; it only declares intent.
 *   - `requires` lists onchain / offchain prerequisites surfaced to the
 *     creator before they pay (e.g. vault deployed, coin bridged).
 *
 * When adding a feature:
 *   1. Add a new entry here with a unique key.
 *   2. Document the provisioning runbook in
 *      `docs/operations/creator-strategy-features.md`.
 *   3. If auto-provisioned, wire the dispatcher in
 *      `frontend/server/_lib/creatorStrategy/provisioner.ts` (create that
 *      file the first time a feature gets auto-provisioning). For now every
 *      feature is manually provisioned by an operator watching `pending`.
 */

export type CreatorStrategyFeatureKey =
  | 'charm_active_lp'
  | 'ajna_sleeve'
  | 'solana_bridge_strategy'
  | 'solana_meteora_alpha_vault'

/**
 * Feature keys that gate a strategy's inclusion at deploy time. These
 * map 1:1 to a `Phase3Params.*WeightBps` field: if the creator has no
 * active activation for the key, the corresponding weight is forced to
 * zero and the strategy is skipped by `DeploymentBatcher` (requires the
 * weight-0-skip contract patch to be live; see
 * `docs/operations/creator-strategy-features.md` § "Strategy gating").
 */
export const DEPLOY_GATING_FEATURE_KEYS = {
  charm: 'charm_active_lp',
  ajna: 'ajna_sleeve',
  solana: 'solana_bridge_strategy',
} as const satisfies Record<'charm' | 'ajna' | 'solana', CreatorStrategyFeatureKey>

export type CreatorStrategyFeatureDefinition = {
  /** Stable machine-readable identifier. */
  key: CreatorStrategyFeatureKey
  /** Human-readable name (UI). */
  displayName: string
  /** One-sentence description (UI). */
  tagline: string
  /** Longer explanation of what the feature does and what provisioning entails. */
  description: string
  /** Price in USDC base units (6 decimals). */
  priceUsdc: bigint
  /** Operator-side tag mapping this feature to its runbook / automation. */
  provisionerTag: string
  /** Structured list of prerequisites surfaced to the creator before they pay. */
  requires: readonly string[]
  /** Estimated time from payment to activation (free-form, for UI copy). */
  estimatedActivationWindow: string
}

/**
 * The default USDC price for a premium feature. Individual features can
 * override but keeping them uniform at $100 is the initial product rule.
 */
export const DEFAULT_CREATOR_STRATEGY_PRICE_USDC: bigint = 100_000_000n // $100.00 at 6 decimals

export const CREATOR_STRATEGY_FEATURE_CATALOG: Record<
  CreatorStrategyFeatureKey,
  CreatorStrategyFeatureDefinition
> = {
  charm_active_lp: {
    key: 'charm_active_lp',
    displayName: 'Charm active LP (CREATOR/USDC)',
    tagline: 'Enable the Charm Alpha Vault concentrated-liquidity strategy on your vault.',
    description:
      'Deploys a CharmStrategy against your creator coin\'s Uniswap V3 CREATOR/USDC pool ' +
      'and registers it on your CreatorOVault. The strategy pulls CREATOR from the vault, ' +
      'swaps the appropriate portion to USDC, and pairs it into an active-LP position that ' +
      'Charm rebalances around price with a narrow base range + wide limit range, harvesting ' +
      'spread + fees. On redemption the position is unwound and proceeds swapped back to ' +
      'CREATOR before returning to the vault. Payment covers the protocol-managed Charm ' +
      'Alpha Vault manager fee setup and keeper bootstrapping.',
    priceUsdc: DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
    provisionerTag: 'phase3_strategy_charm',
    requires: [
      'Must be activated BEFORE vault deploy — the strategy is installed during Phase 3 of DeploymentBatcher; post-deploy enablement is not yet supported',
      'Creator coin must be deployable into a Uniswap V3 CREATOR/USDC pool at fee tier 1 %',
    ],
    estimatedActivationWindow: 'Instant — applied automatically at vault deploy once payment is verified.',
  },
  ajna_sleeve: {
    key: 'ajna_sleeve',
    displayName: 'Ajna lending sleeve',
    tagline: 'Lend your vault\'s idle CREATOR into an Ajna pool and earn interest in CREATOR.',
    description:
      'Deploys an inner ERC-4626 Ajna sleeve (`AjnaERC4626Vault`) whose asset is your ' +
      'creator coin. The sleeve pulls CREATOR from your CreatorOVault and lends it into ' +
      'Ajna pool buckets (CREATOR is the pool\'s quote token; USDC depositors post USDC as ' +
      'collateral to borrow CREATOR). Interest accrues in CREATOR, raising the sleeve\'s ' +
      'exchange rate; an idle buffer keeps fast exits cheap. Payment covers Ajna pool ' +
      'deployment bootstrapping + keeper authorization.',
    priceUsdc: DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
    provisionerTag: 'phase3_strategy_ajna',
    requires: [
      'Must be activated BEFORE vault deploy — the strategy is installed during Phase 3 of DeploymentBatcher; post-deploy enablement is not yet supported',
    ],
    estimatedActivationWindow: 'Instant — applied automatically at vault deploy once payment is verified.',
  },
  solana_bridge_strategy: {
    key: 'solana_bridge_strategy',
    displayName: 'Solana bridge strategy (base)',
    tagline: 'Enable the SolanaStrategy on your vault to bridge CREATOR supply to Solana.',
    description:
      'Deploys a `SolanaStrategy` contract against the canonical `SolanaBridgeAdapter` and ' +
      'registers it on your vault. This is the base Solana integration — it bridges vault-held ' +
      'CREATOR tokens to Solana and accounts for Solana-side NAV via keeper reports. Required ' +
      'prerequisite for the separate `solana_meteora_alpha_vault` add-on (Meteora DLMM + Alpha ' +
      'Vault routing layers on top of this strategy). Payment covers bridge adapter registration ' +
      'gas and Solana keeper bootstrapping.',
    priceUsdc: DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
    provisionerTag: 'phase3_strategy_solana_bridge',
    requires: [
      'Must be activated BEFORE vault deploy — the strategy is installed during Phase 3 of DeploymentBatcher; post-deploy enablement is not yet supported',
      'Creator coin must pass lowercase-parity normalization so the Solana-side wrapped mint can be created (see docs/operations/solana-bridge-naming-invariant.md)',
    ],
    estimatedActivationWindow: 'Instant — applied automatically at vault deploy once payment is verified.',
  },
  solana_meteora_alpha_vault: {
    key: 'solana_meteora_alpha_vault',
    displayName: 'Solana Meteora liquidity',
    tagline: 'Activate a Meteora DLMM pool + Alpha Vault for your creator coin on Solana.',
    description:
      'Creates a permissionless Meteora DLMM pool (SOL-paired) and an Alpha Vault ' +
      'against your creator coin\'s bridge-wrapped Solana mint. Enables Solana-side ' +
      'trading and unlocks the atomic bridge + deposit path used by your vault\'s ' +
      'SolanaStrategy to auto-deploy bridged CREATOR supply into Meteora liquidity. ' +
      'Payment funds ~1 SOL of Solana-side account rent plus operator gas; rent is ' +
      'refundable to the protocol on account close.',
    priceUsdc: DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
    provisionerTag: 'solana_meteora',
    requires: [
      '`solana_bridge_strategy` must already be active on the vault — Meteora routes through that strategy, and without it the Alpha Vault has no bridge-side counterparty',
      'Creator coin deployed on Base with ERC-20 `name()` / `symbol()` that pass strict-parity normalization (name<=32 bytes, symbol<=12 bytes, no null bytes)',
      'Creator coin registered on the canonical SolanaBridgeAdapter (verify with `scripts/verify-solana-mint-parity.ts`)',
    ],
    estimatedActivationWindow: 'Usually within 1 business day; longer if the Solana keeper needs funding.',
  },
} as const

/**
 * Returns a catalog entry, or `null` if the key is not in the catalog.
 * Keep nullable so API handlers can fail with a clean 400 instead of
 * throwing on unknown keys.
 */
export function getCreatorStrategyFeature(
  key: string,
): CreatorStrategyFeatureDefinition | null {
  const match = (CREATOR_STRATEGY_FEATURE_CATALOG as Record<string, CreatorStrategyFeatureDefinition>)[key]
  return match ?? null
}

export function listCreatorStrategyFeatures(): CreatorStrategyFeatureDefinition[] {
  return Object.values(CREATOR_STRATEGY_FEATURE_CATALOG)
}

/**
 * Public-safe serialization for the `/api/creator/strategy/features`
 * endpoint. Converts `priceUsdc` to a string to avoid bigint JSON issues
 * on clients.
 */
export type CreatorStrategyFeatureDto = {
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

export function toCreatorStrategyFeatureDto(
  feature: CreatorStrategyFeatureDefinition,
): CreatorStrategyFeatureDto {
  const whole = feature.priceUsdc / 1_000_000n
  const fraction = feature.priceUsdc % 1_000_000n
  const priceUsdcDisplay =
    fraction === 0n
      ? `$${whole.toString()}`
      : `$${whole.toString()}.${fraction.toString().padStart(6, '0').replace(/0+$/, '')}`
  return {
    key: feature.key,
    displayName: feature.displayName,
    tagline: feature.tagline,
    description: feature.description,
    priceUsdc: feature.priceUsdc.toString(),
    priceUsdcDisplay,
    provisionerTag: feature.provisionerTag,
    requires: feature.requires,
    estimatedActivationWindow: feature.estimatedActivationWindow,
  }
}
