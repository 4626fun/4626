/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_RPC?: string
  readonly VITE_CDP_PAYMASTER_URL?: string
  readonly VITE_PUBLIC_SITE_MODE?: string
  readonly VITE_PRIVY_APP_ID?: string
  readonly VITE_PRIVY_CLIENT_ID?: string
  readonly VITE_PRIVY_ENABLED?: string
  readonly VITE_PRIVY_ALLOWED_ORIGINS?: string
  readonly VITE_PRIVY_DISABLE_ANALYTICS?: string
  readonly VITE_PRIVY_ENABLE_ANALYTICS?: string
  readonly VITE_APP_ORIGIN?: string
  readonly VITE_MARKETING_ORIGIN?: string
  readonly VITE_WAITLIST_REFERRAL_BASE_URL?: string
  readonly VITE_ZORA_COIN_IMPLEMENTATION_ALLOWLIST?: string
  readonly VITE_AKITA_TOKEN: string
  readonly VITE_AKITA_VAULT: string
  readonly VITE_AKITA_WRAPPER: string
  readonly VITE_AKITA_SHARE_OFT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
