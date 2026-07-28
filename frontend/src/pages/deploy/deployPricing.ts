/** Marketing vault deploy pricing shown on /deploy chooser + /deploy/coin. */
export const VAULT_DEPLOY_LIST_USD = 999
export const VAULT_DEPLOY_PROMO_USD = 499
/** Extra discount when the creator coin is launched through 4626 `/deploy/coin`. */
export const VAULT_DEPLOY_COIN_LAUNCH_DISCOUNT_USD = 100

export function formatVaultDeployUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

export function vaultDeployPriceAfterCoinLaunchUsd(): number {
  return VAULT_DEPLOY_PROMO_USD - VAULT_DEPLOY_COIN_LAUNCH_DISCOUNT_USD
}
