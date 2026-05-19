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

import { installEmbeddedOwnerOnSubAccount } from '@/lib/wallet/subAccountOwnerInstall'

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
  | 'install_embedded_owner'
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

  const first = subAccounts[0]
  if (first && isAddress(first.address)) {
    return first
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
 * Configure the Base Account SDK to use the Privy embedded wallet as the
 * signer for sub-account operations. After this call, all transactions sent
 * with `from: subAccountAddress` are signed by the Privy embedded wallet —
 * no passkey prompts.
 *
 * `params` carries the Base Account SDK instance (from `useBaseAccountSdk()`),
 * the `toViemAccount` function from `@privy-io/react-auth`, and the Privy
 * `ConnectedWallet` for the embedded EOA.
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

type SubAccountWalletBundle = {
  baseAccountWallet: {
    address: string
    getEthereumProvider?: () => Promise<any>
    provider?: any
    switchChain?: (chainId: number) => Promise<void>
  }
  embeddedWallet: {
    address: string
    getEthereumProvider?: () => Promise<any>
    provider?: any
  }
  baseAccountSdk: {
    subAccount: {
      setToOwnerAccount: (fn: () => Promise<{ account: any }>) => void
    }
  }
  toViemAccountFn: (args: { wallet: any }) => Promise<any>
  onStageEvent?: (event: SubAccountSetupStageEvent) => void
}

async function resolveSubAccountContext(params: SubAccountWalletBundle): Promise<{
  parentAddress: Address
  embeddedAddress: Address
  provider: any
}> {
  const parentAddress = params.baseAccountWallet.address as Address
  const embeddedAddress = params.embeddedWallet.address as Address
  assertIsAddress(parentAddress, 'Base Account address')
  assertIsAddress(embeddedAddress, 'Embedded wallet address')

  if (typeof params.baseAccountWallet.switchChain === 'function') {
    await params.baseAccountWallet.switchChain(base.id)
  }

  const provider = await getProviderFromWallet(params.baseAccountWallet)

  // Base App returns 4100 when sub-account RPC runs before account authorization.
  try {
    await provider.request({ method: 'eth_requestAccounts' })
  } catch {
    /* best-effort — proceed if the wallet already authorized this session */
  }

  return { parentAddress, embeddedAddress, provider }
}

/**
 * Phase 1 — discover or create the per-app sub-account (one passkey prompt
 * when creating). Does not install on-chain owner or configure the SDK signer.
 */
export async function provisionSubAccount(
  params: SubAccountWalletBundle,
): Promise<SubAccountSetupResult & { provider: any }> {
  const { onStageEvent } = params
  const { parentAddress, embeddedAddress, provider } = await resolveSubAccountContext(params)

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
  }

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

  return {
    subAccountAddress: subAccount.address,
    parentAddress,
    created,
    provider,
  }
}

/**
 * Phase 2 — user signs `addOwnerAddress(privyEmbeddedEoa)` on the sub-account.
 */
export async function confirmSubAccountEmbeddedOwner(params: {
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  parentAddress: Address
  subAccountAddress: Address
  embeddedEoaAddress: Address
  onStageEvent?: (event: SubAccountSetupStageEvent) => void
}): Promise<{ alreadyOwner: boolean; transactionHash: Hex | null }> {
  const { onStageEvent, parentAddress, subAccountAddress, embeddedEoaAddress, provider } = params

  onStageEvent?.({
    stage: 'install_embedded_owner',
    status: 'start',
    parentAddress,
    subAccountAddress,
  })

  try {
    const result = await installEmbeddedOwnerOnSubAccount({
      provider,
      subAccountAddress,
      embeddedEoaAddress,
    })
    onStageEvent?.({
      stage: 'install_embedded_owner',
      status: 'success',
      parentAddress,
      subAccountAddress,
      message: result.alreadyOwner ? 'already_owner' : 'installed',
    })
    return {
      alreadyOwner: result.alreadyOwner,
      transactionHash: result.transactionHash,
    }
  } catch (err) {
    onStageEvent?.({
      stage: 'install_embedded_owner',
      status: 'error',
      parentAddress,
      subAccountAddress,
      message: err instanceof Error ? err.message : String(err),
    })
    throw new Error(
      `Failed to enable 4626 signing on your app wallet: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Phase 3 — route future sub-account sends through the Privy embedded EOA (silent).
 */
export async function finalizeSubAccountSigner(params: SubAccountWalletBundle & {
  subAccountAddress: Address
  parentAddress: Address
}): Promise<void> {
  const { onStageEvent, subAccountAddress, parentAddress } = params

  onStageEvent?.({
    stage: 'configure_signer',
    status: 'start',
    subAccountAddress,
    parentAddress,
  })

  try {
    configureSubAccountSigner({
      baseAccountSdk: params.baseAccountSdk,
      toViemAccountFn: params.toViemAccountFn,
      embeddedWallet: params.embeddedWallet,
    })
    onStageEvent?.({
      stage: 'configure_signer',
      status: 'success',
      subAccountAddress,
      parentAddress,
    })
  } catch (err) {
    onStageEvent?.({
      stage: 'configure_signer',
      status: 'error',
      subAccountAddress,
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
    subAccountAddress,
    parentAddress,
  })
}

// ── Main Orchestrator ──────────────────────────────────────────────

/**
 * Full sub-account setup flow (all phases in one call):
 *   1. Discover or create sub-account
 *   2. addOwnerAddress(embedded EOA) on the sub-account
 *   3. Configure Privy embedded wallet as SDK signer
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
  const provisioned = await provisionSubAccount(params)
  await confirmSubAccountEmbeddedOwner({
    provider: provisioned.provider,
    parentAddress: provisioned.parentAddress,
    subAccountAddress: provisioned.subAccountAddress,
    embeddedEoaAddress: params.embeddedWallet.address as Address,
    onStageEvent: params.onStageEvent,
  })
  await finalizeSubAccountSigner({
    ...params,
    parentAddress: provisioned.parentAddress,
    subAccountAddress: provisioned.subAccountAddress,
  })
  return {
    subAccountAddress: provisioned.subAccountAddress,
    parentAddress: provisioned.parentAddress,
    created: provisioned.created,
  }
}
