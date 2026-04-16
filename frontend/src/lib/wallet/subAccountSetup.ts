/**
 * Sub-Account Setup
 *
 * Uses the CSW sub-account model instead of `addOwnerAddress`.
 *
 * Flow:
 *   1. User connects CSW (Base Account) via passkey — one-time popup.
 *   2. Check for an existing sub-account via `wallet_getSubAccounts`.
 *   3. If none, create one via `wallet_addSubAccount` with the Privy
 *      embedded wallet address as the initial signer key — one-time popup.
 *   4. Call `setToOwnerAccount` on the Base Account SDK so all future
 *      transactions from the sub-account address are signed by the
 *      Privy embedded wallet (no passkey prompts, no popup).
 *
 * Why this works:
 *   - Sub-account transactions route through `wallet_prepareCalls` →
 *     `owner.sign()` → `wallet_sendPreparedCalls` (RPC path, no popup).
 *   - The `owner.sign()` call uses the Privy embedded wallet (secp256k1),
 *     not the passkey, so no WebAuthn prompt is needed.
 *   - The CSW popup's `eGe` self-call guard is never triggered because
 *     the sub-account is a separate contract address (from ≠ to).
 */

import type { Address, Hex } from 'viem'
import { isAddress } from 'viem'
import { base } from 'viem/chains'

// ── Types ──────────────────────────────────────────────────────────

export type SubAccount = {
  address: Address
  factory?: Address
  factoryData?: Hex
}

export type SubAccountSetupResult = {
  subAccountAddress: Address
  parentAddress: Address
  created: boolean
}

export type SubAccountSetupStage =
  | 'check_existing'
  | 'create_sub_account'
  | 'configure_signer'
  | 'done'

export type SubAccountSetupStageEvent = {
  stage: SubAccountSetupStage
  status: 'start' | 'success' | 'error'
  subAccountAddress?: string | null
  parentAddress?: string | null
  message?: string
}

// ── Helpers ────────────────────────────────────────────────────────

function assertIsAddress(value: unknown, label: string): asserts value is Address {
  if (typeof value !== 'string' || !isAddress(value)) {
    throw new Error(`${label} is not a valid address: ${String(value)}`)
  }
}

/**
 * Get the EIP-1193 provider from a Privy ConnectedWallet.
 * The wallet object may have `getEthereumProvider()` or already
 * expose a `.provider` field depending on the Privy SDK version.
 */
async function getProviderFromWallet(wallet: {
  getEthereumProvider?: () => Promise<any>
  provider?: any
}): Promise<any> {
  if (typeof wallet.getEthereumProvider === 'function') {
    return wallet.getEthereumProvider()
  }
  if (wallet.provider) {
    return wallet.provider
  }
  throw new Error('Cannot get EIP-1193 provider from wallet.')
}

// ── Core Functions ─────────────────────────────────────────────────

/**
 * Check for an existing sub-account on the Base Account for the current
 * app domain.  Returns the sub-account if found, or null.
 */
export async function getExistingSubAccount(params: {
  provider: any
  parentAddress: Address
}): Promise<SubAccount | null> {
  const { provider, parentAddress } = params

  const response = await provider.request({
    method: 'wallet_getSubAccounts',
    params: [
      {
        account: parentAddress,
        domain: typeof window !== 'undefined' ? window.location.origin : '',
      },
    ],
  })

  const subAccounts =
    response && typeof response === 'object' && 'subAccounts' in response
      ? (response as { subAccounts: SubAccount[] }).subAccounts
      : Array.isArray(response)
        ? (response as SubAccount[])
        : []

  if (subAccounts.length > 0 && isAddress(subAccounts[0].address)) {
    return subAccounts[0]
  }
  return null
}

/**
 * Create a new sub-account with the Privy embedded wallet address as
 * the initial signer key.  Triggers one passkey popup for the user.
 */
export async function createSubAccount(params: {
  provider: any
  embeddedWalletAddress: Address
}): Promise<SubAccount> {
  const { provider, embeddedWalletAddress } = params

  const result = await provider.request({
    method: 'wallet_addSubAccount',
    params: [
      {
        version: '1',
        account: {
          type: 'create',
          keys: [
            {
              type: 'address',
              publicKey: embeddedWalletAddress,
            },
          ],
        },
      },
    ],
  })

  if (!result || typeof result !== 'object' || !('address' in result)) {
    throw new Error('wallet_addSubAccount did not return a valid sub-account.')
  }

  const subAccount = result as SubAccount
  assertIsAddress(subAccount.address, 'sub-account address')
  return subAccount
}

/**
 * Configure the Base Account SDK to use the Privy embedded wallet as
 * the signer for sub-account operations.  After this call, all
 * transactions sent with `from: subAccountAddress` are signed by the
 * Privy embedded wallet — no passkey prompts.
 *
 * @param baseAccountSdk  The SDK instance from `useBaseAccountSdk()`.
 * @param toViemAccountFn The `toViemAccount` function from `@privy-io/react-auth`.
 * @param embeddedWallet  The Privy ConnectedWallet for the embedded EOA.
 */
export function configureSubAccountSigner(params: {
  baseAccountSdk: {
    subAccount: {
      setToOwnerAccount: (fn: () => Promise<{ account: any }>) => void
    }
  }
  toViemAccountFn: (args: { wallet: any }) => Promise<any>
  embeddedWallet: any
}): void {
  const { baseAccountSdk, toViemAccountFn, embeddedWallet } = params

  baseAccountSdk.subAccount.setToOwnerAccount(async () => {
    const account = await toViemAccountFn({ wallet: embeddedWallet })
    return { account }
  })
}

// ── Main Orchestrator ──────────────────────────────────────────────

/**
 * Full sub-account setup flow:
 *   1. Get CSW provider from the Base Account wallet
 *   2. Check for existing sub-account
 *   3. Create one if needed (one-time passkey popup)
 *   4. Configure Privy embedded wallet as signer
 *
 * Returns the sub-account address for use as the app's execution address.
 */
export async function setupSubAccount(params: {
  /** The Privy ConnectedWallet for the Base Account (CSW). */
  baseAccountWallet: {
    address: string
    getEthereumProvider?: () => Promise<any>
    provider?: any
    switchChain?: (chainId: number) => Promise<void>
  }
  /** The Privy ConnectedWallet for the embedded EOA. */
  embeddedWallet: {
    address: string
    getEthereumProvider?: () => Promise<any>
    provider?: any
  }
  /** The Base Account SDK instance from `useBaseAccountSdk()`. */
  baseAccountSdk: {
    subAccount: {
      setToOwnerAccount: (fn: () => Promise<{ account: any }>) => void
    }
  }
  /** The `toViemAccount` utility from `@privy-io/react-auth`. */
  toViemAccountFn: (args: { wallet: any }) => Promise<any>
  /** Optional callback for stage events. */
  onStageEvent?: (event: SubAccountSetupStageEvent) => void
}): Promise<SubAccountSetupResult> {
  const {
    baseAccountWallet,
    embeddedWallet,
    baseAccountSdk,
    toViemAccountFn,
    onStageEvent,
  } = params

  const parentAddress = baseAccountWallet.address as Address
  const embeddedAddress = embeddedWallet.address as Address
  assertIsAddress(parentAddress, 'Base Account address')
  assertIsAddress(embeddedAddress, 'Embedded wallet address')

  // Ensure we're on Base
  if (typeof baseAccountWallet.switchChain === 'function') {
    await baseAccountWallet.switchChain(base.id)
  }

  const provider = await getProviderFromWallet(baseAccountWallet)

  // Step 1: Check for existing sub-account
  onStageEvent?.({ stage: 'check_existing', status: 'start', parentAddress })
  let subAccount: SubAccount | null = null
  let created = false

  try {
    subAccount = await getExistingSubAccount({ provider, parentAddress })
    onStageEvent?.({
      stage: 'check_existing',
      status: 'success',
      parentAddress,
      subAccountAddress: subAccount?.address ?? null,
    })
  } catch (err) {
    onStageEvent?.({
      stage: 'check_existing',
      status: 'error',
      parentAddress,
      message: err instanceof Error ? err.message : String(err),
    })
    // Non-fatal: if we can't check, try creating
  }

  // Step 2: Create sub-account if none exists
  if (!subAccount) {
    onStageEvent?.({ stage: 'create_sub_account', status: 'start', parentAddress })
    try {
      subAccount = await createSubAccount({
        provider,
        embeddedWalletAddress: embeddedAddress,
      })
      created = true
      onStageEvent?.({
        stage: 'create_sub_account',
        status: 'success',
        parentAddress,
        subAccountAddress: subAccount.address,
      })
    } catch (err) {
      onStageEvent?.({
        stage: 'create_sub_account',
        status: 'error',
        parentAddress,
        message: err instanceof Error ? err.message : String(err),
      })
      throw new Error(
        `Failed to create sub-account: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // Step 3: Configure the embedded wallet as the sub-account signer
  onStageEvent?.({
    stage: 'configure_signer',
    status: 'start',
    subAccountAddress: subAccount.address,
    parentAddress,
  })

  try {
    configureSubAccountSigner({
      baseAccountSdk,
      toViemAccountFn,
      embeddedWallet,
    })
    onStageEvent?.({
      stage: 'configure_signer',
      status: 'success',
      subAccountAddress: subAccount.address,
      parentAddress,
    })
  } catch (err) {
    onStageEvent?.({
      stage: 'configure_signer',
      status: 'error',
      subAccountAddress: subAccount.address,
      parentAddress,
      message: err instanceof Error ? err.message : String(err),
    })
    throw new Error(
      `Failed to configure sub-account signer: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  onStageEvent?.({
    stage: 'done',
    status: 'success',
    subAccountAddress: subAccount.address,
    parentAddress,
  })

  return {
    subAccountAddress: subAccount.address,
    parentAddress,
    created,
  }
}
