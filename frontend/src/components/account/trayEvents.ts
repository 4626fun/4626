export const OPEN_ACCOUNT_TRAY_EVENT = 'vault:open-account-tray'
export const ACCOUNT_WALLET_SUMMARY_EVENT = 'vault:account-wallet-summary'

export type AccountTraySection = 'account' | 'portfolio' | 'points'
export type AccountTrayTab = 'tokens' | 'activity'

export type AccountTrayOpenDetail = {
  section?: AccountTraySection
  tab?: AccountTrayTab
  source?: 'mobile-nav' | 'desktop-nav' | 'programmatic'
}

export function requestOpenAccountTray(detail: AccountTrayOpenDetail = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AccountTrayOpenDetail>(OPEN_ACCOUNT_TRAY_EVENT, { detail }))
}

export type AccountWalletSummaryDetail = {
  activeNetworkUsd: number | null
}

export function publishAccountWalletSummary(detail: AccountWalletSummaryDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AccountWalletSummaryDetail>(ACCOUNT_WALLET_SUMMARY_EVENT, { detail }))
}
