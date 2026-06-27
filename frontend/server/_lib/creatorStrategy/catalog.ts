/**
 * Creator strategy feature catalog.
 *
 * Greenfield vault deploy sells one public SKU: **`vault_full_deploy`**
 * ($499 USDC). Payment expands into bundled sub-entitlements (Charm,
 * Ajna, Solana mesh, Meteora) via `expandCreatorFeatureKeys`. Individual
 * à-la-carte purchases of bundled keys return HTTP 410. Legacy per-key
 * rows from operator comps still resolve for grandfathered creators.
 *
 * See `docs/operations/creator-strategy-features.md` for the full product
 * model (bundle, weight scaling, legacy partial entitlements).
 *
 * Design rules (keep this file boring and declarative):
 *   - Prices are in USDC base units (6 decimals). 499e6 = $499 bundle.
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
  | 'vault_full_deploy'
  | 'charm_active_lp'
  | 'ajna_sleeve'
  | 'solana_ovault_mesh'
  | 'solana_meteora_alpha_vault'
  | `deploy_vanity_vault_prefix_len_${DeployVanityLength}`
  | `deploy_vanity_share_suffix_len_${DeployVanityLength}`

/** Single SKU for new vault deploys — includes all bundled sub-features below. */
export const FULL_VAULT_DEPLOY_FEATURE_KEY = 'vault_full_deploy' as const satisfies CreatorStrategyFeatureKey

/** $499.00 USDC at 6 decimals. */
export const FULL_VAULT_DEPLOY_PRICE_USDC = 499_000_000n

/**
 * Entitlements granted by `vault_full_deploy`. Legacy rows for these keys
 * still work; new purchases should use the bundle only.
 */
export const FULL_DEPLOY_BUNDLE_GRANTED_KEYS = [
  'charm_active_lp',
  'ajna_sleeve',
  'solana_ovault_mesh',
  'solana_meteora_alpha_vault',
] as const satisfies readonly CreatorStrategyFeatureKey[]

const ALACARTE_DEPLOY_FEATURE_KEYS = new Set<string>(FULL_DEPLOY_BUNDLE_GRANTED_KEYS)

export function isAlacarteDeployFeatureKey(key: string): boolean {
  return ALACARTE_DEPLOY_FEATURE_KEYS.has(String(key ?? '').trim())
}

export const DEPLOY_VANITY_ALLOWED_LENGTHS = [1, 2, 3, 4, 5] as const
export type DeployVanityLength = (typeof DEPLOY_VANITY_ALLOWED_LENGTHS)[number]
export type DeployVanityFeatureKind = 'vaultPrefix' | 'shareSuffix'

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
} as const satisfies Record<'charm' | 'ajna', CreatorStrategyFeatureKey>

/** Retired keys may still exist on historical DB rows; they are not purchasable. */
export const RETIRED_CREATOR_STRATEGY_FEATURE_KEYS = ['solana_bridge_strategy'] as const

export type RetiredCreatorStrategyFeatureKey =
  (typeof RETIRED_CREATOR_STRATEGY_FEATURE_KEYS)[number]

export function isRetiredCreatorStrategyFeatureKey(
  key: string,
): key is RetiredCreatorStrategyFeatureKey {
  return (RETIRED_CREATOR_STRATEGY_FEATURE_KEYS as readonly string[]).includes(key)
}

export function getRetiredCreatorStrategyFeatureMessage(key: string): string | null {
  if (key === 'solana_bridge_strategy') {
    return (
      'solana_bridge_strategy was retired. Greenfield vaults seed Solana share liquidity via ' +
      'the 30% ShareOFT auto-bridge at finalizePhase2. Activate solana_ovault_mesh for ' +
      'cross-chain compose routing instead.'
    )
  }
  return isRetiredCreatorStrategyFeatureKey(key)
    ? `${key} is retired and cannot be purchased.`
    : null
}

/**
 * Paid vanity feature keys used by deploy session validation.
 * These do not affect Phase-3 strategy weights; they gate vanity
 * address customization only.
 */
export const DEPLOY_VANITY_FEATURE_KEYS_BY_KIND_AND_LENGTH = {
  vaultPrefix: {
    1: 'deploy_vanity_vault_prefix_len_1',
    2: 'deploy_vanity_vault_prefix_len_2',
    3: 'deploy_vanity_vault_prefix_len_3',
    4: 'deploy_vanity_vault_prefix_len_4',
    5: 'deploy_vanity_vault_prefix_len_5',
  },
  shareSuffix: {
    1: 'deploy_vanity_share_suffix_len_1',
    2: 'deploy_vanity_share_suffix_len_2',
    3: 'deploy_vanity_share_suffix_len_3',
    4: 'deploy_vanity_share_suffix_len_4',
    5: 'deploy_vanity_share_suffix_len_5',
  },
} as const satisfies Record<DeployVanityFeatureKind, Record<DeployVanityLength, CreatorStrategyFeatureKey>>

export const DEPLOY_VANITY_PRICE_USDC_BY_LENGTH = {
  1: 25_000_000n, // $25
  2: 75_000_000n, // $75
  3: 200_000_000n, // $200
  4: 500_000_000n, // $500
  5: 1_250_000_000n, // $1,250
} as const satisfies Record<DeployVanityLength, bigint>

export function getDeployVanityFeatureKey(params: {
  kind: DeployVanityFeatureKind
  length: number
}): CreatorStrategyFeatureKey | null {
  const normalized = Math.floor(params.length)
  if (!DEPLOY_VANITY_ALLOWED_LENGTHS.includes(normalized as DeployVanityLength)) return null
  return DEPLOY_VANITY_FEATURE_KEYS_BY_KIND_AND_LENGTH[params.kind][normalized as DeployVanityLength]
}

export function listDeployVanityFeatureKeysAtOrAbove(params: {
  kind: DeployVanityFeatureKind
  minLength: number
}): CreatorStrategyFeatureKey[] {
  const normalized = Math.floor(params.minLength)
  if (!Number.isFinite(normalized)) return []
  return DEPLOY_VANITY_ALLOWED_LENGTHS
    .filter((length) => length >= normalized)
    .map((length) => DEPLOY_VANITY_FEATURE_KEYS_BY_KIND_AND_LENGTH[params.kind][length])
}

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
 * Legacy list price for bundled sub-feature catalog entries and vanity tiers
 * ($100). Public greenfield deploy SKU is `FULL_VAULT_DEPLOY_PRICE_USDC` ($499).
 */
export const DEFAULT_CREATOR_STRATEGY_PRICE_USDC: bigint = 100_000_000n // $100.00 at 6 decimals

export const CREATOR_STRATEGY_FEATURE_CATALOG: Record<
  CreatorStrategyFeatureKey,
  CreatorStrategyFeatureDefinition
> = {
  vault_full_deploy: {
    key: 'vault_full_deploy',
    displayName: 'Full vault deploy',
    tagline: 'One payment unlocks your complete vault on Base, with optional Solana trading.',
    description:
      'The all-in-one launch bundle: Charm active LP and Ajna lending on Base, optional post-auction ' +
      'Solana bridge for tradable shares (~30% supply at finalize), and Meteora pool entitlement ' +
      'on the bridged share. Pay once, deploy once — no separate strategy purchases.',
    priceUsdc: FULL_VAULT_DEPLOY_PRICE_USDC,
    provisionerTag: 'vault_full_deploy_bundle',
    requires: [
      'Creator coin must be deployable before payment',
      'Includes Charm + Ajna strategies (45% / 45% productive split, 10% idle)',
      'Includes optional Solana bridge + Meteora pool entitlement',
      'Vanity address tiers remain optional add-ons',
    ],
    estimatedActivationWindow: 'Instant — deploy unlocks as soon as payment is verified.',
  },
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
  solana_ovault_mesh: {
    key: 'solana_ovault_mesh',
    displayName: 'Solana OVault composer mesh (Phase 2b)',
    tagline: 'Enable cross-chain OVault compose routing for Solana asset/share flows.',
    description:
      'Enables the Phase-2b OVault composer mesh path in deploy sessions. This configures and validates ' +
      'the `CreatorOVaultComposer` route invariants (asset/share mesh tokens + Solana peers) before ' +
      'post-Phase2 stages continue. It powers the cross-chain deposit/redeem lane where Solana-origin ' +
      'asset flow can compose into Base-side wrapper deposit and emit share-token flow for Solana paths.',
    priceUsdc: DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
    provisionerTag: 'deploy_phase2b_ovault_mesh',
    requires: [
      'Used only when deploy session requests `solanaOvault.enabled=true`',
      'Deploy lane entitlement is satisfied by `solana_ovault_mesh` or `solana_meteora_alpha_vault`',
      'Share mesh seeding (30% of ShareOFT) auto-bridges at finalizePhase2 when OVault runtime is enabled on the batcher',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  solana_meteora_alpha_vault: {
    key: 'solana_meteora_alpha_vault',
    displayName: 'Solana Meteora liquidity',
    tagline: 'Activate a Meteora DLMM pool + Alpha Vault for your creator coin on Solana.',
    description:
      'Optional post-deploy Meteora DLMM pool + Alpha Vault on the **share-mesh mint** ' +
      '(`■<TICKER>`) seeded by the 30% ShareOFT auto-bridge at finalizePhase2 — not ' +
      'bridge-wrapped creator SPL. Enables Solana-side share trading after Path 1/2 ' +
      'from docs/operations/solana-share-mesh-budget-paths.md. Payment funds operator ' +
      'Solana rent + gas.',
    priceUsdc: DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
    provisionerTag: 'solana_meteora',
    requires: [
      '`solana_ovault_mesh` must already be active — share mesh seeded at finalizePhase2',
      'Path 1 share-mesh OFT live with batcher `solanaShareOftPeer` wired before Meteora pool create',
      'Use `create-dlmm-pool.ts` with the LZ share mint as `TOKEN_MINT_X` (see share-mesh budget runbook)',
    ],
    estimatedActivationWindow: 'Usually within 1 business day; longer if the Solana keeper needs funding.',
  },
  deploy_vanity_vault_prefix_len_1: {
    key: 'deploy_vanity_vault_prefix_len_1',
    displayName: 'Deploy vanity: vault prefix (1 char)',
    tagline: 'Unlock custom vault prefix targeting for 1 hex character.',
    description:
      'Enables paid custom vault-address vanity targeting during deploy planning. This tier supports ' +
      '1 custom hex character after `0x` for the vault CREATE2 address. Free default prefix `0x4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[1],
    provisionerTag: 'deploy_vanity_vault_prefix_len_1',
    requires: [
      'Feature is consumed by deploy-session validation when custom vanity vault prefix is requested',
      'Higher prefix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_vault_prefix_len_2: {
    key: 'deploy_vanity_vault_prefix_len_2',
    displayName: 'Deploy vanity: vault prefix (2 chars)',
    tagline: 'Unlock custom vault prefix targeting for 2 hex characters.',
    description:
      'Enables paid custom vault-address vanity targeting during deploy planning. This tier supports ' +
      '2 custom hex characters after `0x` for the vault CREATE2 address. Free default prefix `0x4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[2],
    provisionerTag: 'deploy_vanity_vault_prefix_len_2',
    requires: [
      'Feature is consumed by deploy-session validation when custom vanity vault prefix is requested',
      'Higher prefix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_vault_prefix_len_3: {
    key: 'deploy_vanity_vault_prefix_len_3',
    displayName: 'Deploy vanity: vault prefix (3 chars)',
    tagline: 'Unlock custom vault prefix targeting for 3 hex characters.',
    description:
      'Enables paid custom vault-address vanity targeting during deploy planning. This tier supports ' +
      '3 custom hex characters after `0x` for the vault CREATE2 address. Free default prefix `0x4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[3],
    provisionerTag: 'deploy_vanity_vault_prefix_len_3',
    requires: [
      'Feature is consumed by deploy-session validation when custom vanity vault prefix is requested',
      'Higher prefix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_vault_prefix_len_4: {
    key: 'deploy_vanity_vault_prefix_len_4',
    displayName: 'Deploy vanity: vault prefix (4 chars)',
    tagline: 'Unlock custom vault prefix targeting for 4 hex characters.',
    description:
      'Enables paid custom vault-address vanity targeting during deploy planning. This tier supports ' +
      '4 custom hex characters after `0x` for the vault CREATE2 address. Free default prefix `0x4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[4],
    provisionerTag: 'deploy_vanity_vault_prefix_len_4',
    requires: [
      'Feature is consumed by deploy-session validation when custom vanity vault prefix is requested',
      'Higher prefix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_vault_prefix_len_5: {
    key: 'deploy_vanity_vault_prefix_len_5',
    displayName: 'Deploy vanity: vault prefix (5 chars)',
    tagline: 'Unlock custom vault prefix targeting for 5 hex characters.',
    description:
      'Enables paid custom vault-address vanity targeting during deploy planning. This tier supports ' +
      '5 custom hex characters after `0x` for the vault CREATE2 address. Free default prefix `0x4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[5],
    provisionerTag: 'deploy_vanity_vault_prefix_len_5',
    requires: [
      'Feature is consumed by deploy-session validation when custom vanity vault prefix is requested',
      'Vanity matching remains best-effort within configured search limits',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_share_suffix_len_1: {
    key: 'deploy_vanity_share_suffix_len_1',
    displayName: 'Deploy vanity: share suffix (1 char)',
    tagline: 'Unlock custom share-token suffix vanity for 1 hex character.',
    description:
      'Enables paid custom ShareOFT address suffix vanity during Phase 1 planning. This tier supports ' +
      '1 custom hex character at the end of the share token address. Free default suffix `4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[1],
    provisionerTag: 'deploy_vanity_share_suffix_len_1',
    requires: [
      'Feature is consumed by deploy-session validation when custom share vanity is requested',
      'Guaranteed suffix requires batcher support for phase1WithSalt / split Phase-1 with salt selectors',
      'Higher suffix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_share_suffix_len_2: {
    key: 'deploy_vanity_share_suffix_len_2',
    displayName: 'Deploy vanity: share suffix (2 chars)',
    tagline: 'Unlock custom share-token suffix vanity for 2 hex characters.',
    description:
      'Enables paid custom ShareOFT address suffix vanity during Phase 1 planning. This tier supports ' +
      '2 custom hex characters at the end of the share token address. Free default suffix `4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[2],
    provisionerTag: 'deploy_vanity_share_suffix_len_2',
    requires: [
      'Feature is consumed by deploy-session validation when custom share vanity is requested',
      'Guaranteed suffix requires batcher support for phase1WithSalt / split Phase-1 with salt selectors',
      'Higher suffix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_share_suffix_len_3: {
    key: 'deploy_vanity_share_suffix_len_3',
    displayName: 'Deploy vanity: share suffix (3 chars)',
    tagline: 'Unlock custom share-token suffix vanity for 3 hex characters.',
    description:
      'Enables paid custom ShareOFT address suffix vanity during Phase 1 planning. This tier supports ' +
      '3 custom hex characters at the end of the share token address. Free default suffix `4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[3],
    provisionerTag: 'deploy_vanity_share_suffix_len_3',
    requires: [
      'Feature is consumed by deploy-session validation when custom share vanity is requested',
      'Guaranteed suffix requires batcher support for phase1WithSalt / split Phase-1 with salt selectors',
      'Higher suffix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_share_suffix_len_4: {
    key: 'deploy_vanity_share_suffix_len_4',
    displayName: 'Deploy vanity: share suffix (4 chars)',
    tagline: 'Unlock custom share-token suffix vanity for 4 hex characters.',
    description:
      'Enables paid custom ShareOFT address suffix vanity during Phase 1 planning. This tier supports ' +
      '4 custom hex characters at the end of the share token address. Free default suffix `4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[4],
    provisionerTag: 'deploy_vanity_share_suffix_len_4',
    requires: [
      'Feature is consumed by deploy-session validation when custom share vanity is requested',
      'Guaranteed suffix requires batcher support for phase1WithSalt / split Phase-1 with salt selectors',
      'Higher suffix-length tiers also satisfy this tier',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
  },
  deploy_vanity_share_suffix_len_5: {
    key: 'deploy_vanity_share_suffix_len_5',
    displayName: 'Deploy vanity: share suffix (5 chars)',
    tagline: 'Unlock custom share-token suffix vanity for 5 hex characters.',
    description:
      'Enables paid custom ShareOFT address suffix vanity during Phase 1 planning. This tier supports ' +
      '5 custom hex characters at the end of the share token address. Free default suffix `4626` remains available without activation.',
    priceUsdc: DEPLOY_VANITY_PRICE_USDC_BY_LENGTH[5],
    provisionerTag: 'deploy_vanity_share_suffix_len_5',
    requires: [
      'Feature is consumed by deploy-session validation when custom share vanity is requested',
      'Guaranteed suffix requires batcher support for phase1WithSalt / split Phase-1 with salt selectors',
      'Vanity matching remains best-effort within configured search limits',
    ],
    estimatedActivationWindow: 'Instant — entitlement is active as soon as payment is verified.',
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

/** Public purchase catalog: full deploy bundle + optional vanity tiers only. */
export function listCreatorStrategyFeaturesForPurchase(): CreatorStrategyFeatureDefinition[] {
  return listCreatorStrategyFeatures().filter(
    (feature) =>
      feature.key === FULL_VAULT_DEPLOY_FEATURE_KEY ||
      feature.key.startsWith('deploy_vanity_'),
  )
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
