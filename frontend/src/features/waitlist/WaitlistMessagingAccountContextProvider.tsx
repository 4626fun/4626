import { useMemo, type ReactNode } from 'react'
import { getAddress, isAddress } from 'viem'

import { AccountContext } from '@/wallet/accountContext/useAccountContext'
import type { AccountContextValue } from '@/wallet/accountContext/useAccountContext'

const BASE_CHAIN_ID = 8453

const EMPTY_CAPABILITIES = {
  paymasterService: false,
  atomicStatus: 'unknown' as const,
  supports5792: false,
}

const EMPTY_UI_FLAGS = {
  aaAvailable: false,
  paymasterAvailable: false,
  canUseSmartWalletMode: true,
  shouldPromptToLinkOwner: false,
  shouldShowNetworkMismatch: false,
}

function normalizeAddress(value: string | null | undefined): `0x${string}` | undefined {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return undefined
  return getAddress(raw).toLowerCase() as `0x${string}`
}

/**
 * Static account context for waitlist XMTP — avoids AccountContextProvider's wagmi
 * queries racing wagmi Hydrate on the route-scoped messaging config.
 */
export function WaitlistMessagingAccountContextProvider(props: {
  children: ReactNode
  xmtpMemberAddress: string | null
}) {
  const cswAddress = normalizeAddress(props.xmtpMemberAddress)

  const value = useMemo<AccountContextValue>(
    () => ({
      chainId: BASE_CHAIN_ID,
      chainIdHex: '0x2105',
      signerAddress: undefined,
      signerType: 'EOA',
      cswAddress,
      eoaIsOwnerOfCsw: cswAddress ? true : null,
      activeAccount: cswAddress,
      activeAccountType: cswAddress ? 'SMART_WALLET' : 'UNKNOWN',
      capabilities: EMPTY_CAPABILITIES,
      uiFlags: EMPTY_UI_FLAGS,
      preferredMode: 'SMART_WALLET',
      loading: false,
      actions: {
        refresh: async () => undefined,
        setPreferredMode: () => undefined,
      },
    }),
    [cswAddress],
  )

  return <AccountContext.Provider value={value}>{props.children}</AccountContext.Provider>
}
