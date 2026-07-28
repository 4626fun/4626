/** Marketing vault deploy pricing shown on /deploy chooser + /deploy/coin. */
export const VAULT_DEPLOY_LIST_USD = 999
/** Current public SKU (`vault_full_deploy`) — keep aligned with catalog `$499`. */
export const VAULT_DEPLOY_PROMO_USD = 499
/**
 * Coin-launch promo discount advertised on `/deploy/coin`.
 * Checkout still sells `vault_full_deploy` at `$499` until a discounted SKU / override ships.
 */
export const VAULT_DEPLOY_COIN_LAUNCH_DISCOUNT_USD = 100

export function formatVaultDeployUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

/** Marketing target after the coin-launch discount (not a separate catalog SKU yet). */
export function vaultDeployPriceAfterCoinLaunchUsd(): number {
  return VAULT_DEPLOY_PROMO_USD - VAULT_DEPLOY_COIN_LAUNCH_DISCOUNT_USD
}
