import { createPublicClient, createWalletClient, getAddress, http, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { isLocalForkRpcUrl } from '../onchain/baseRpcUrl.js'
import type { ForkImpersonationMode } from './ensureBatcherRegistryAuthorization.js'
import { ensurePhase3DryRunHelperOnFork } from './ensurePhase3DryRunHelperOnFork.js'
import { ensurePhase3HelperCreate2AuthorizationOnFork } from './ensurePhase3HelperCreate2Authorization.js'
import { ensureVaultAuxiliaryDeployBatcherOnFork } from './ensureVaultAuxiliaryDeployBatcherOnFork.js'

const DEFAULT_FORK_BALANCE_HEX = '0x56bc75e2d63100000' as Hex

const ANVIL_FORK_MODE: ForkImpersonationMode = {
  name: 'anvil',
  impersonateMethod: 'anvil_impersonateAccount',
  stopMethod: 'anvil_stopImpersonatingAccount',
  setBalanceMethod: 'anvil_setBalance',
}

async function forkRequestFromRpc(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (json.error) throw new Error(json.error.message ?? `fork ${method} failed`)
  return json.result
}

export async function ensurePhase3DryRunForkPrep(params: {
  rpcUrl: string
  batcher: Address
  ownerBalanceHex?: Hex
  forkMode?: ForkImpersonationMode
}): Promise<{
  ran: boolean
  helperAlreadyAligned: boolean
  helperEnsured: boolean
  create2AlreadyAuthorized: boolean
  create2Ensured: boolean
  phase3Helper: Address
  create2Deployer: Address
  auxiliaryAlreadyAligned: boolean
  auxiliaryEnsured: boolean
  configuredAuxiliaryBatcher: Address
  previousAuxiliaryBatcher: Address
  auxiliaryBatcher: Address
  auxiliaryCreate2AlreadyAuthorized: boolean
  auxiliaryCreate2Ensured: boolean
}> {
  const rpcUrl = params.rpcUrl.trim()
  if (!isLocalForkRpcUrl(rpcUrl)) {
    throw new Error('ensurePhase3DryRunForkPrep requires a local fork RPC URL')
  }

  const batcher = getAddress(params.batcher)
  const ownerBalanceHex = params.ownerBalanceHex ?? DEFAULT_FORK_BALANCE_HEX
  const forkMode = params.forkMode ?? ANVIL_FORK_MODE
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
  const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
  const forkRequest = (args: { method: string; params?: unknown[] }) =>
    forkRequestFromRpc(rpcUrl, args.method, args.params ?? [])
  const waitForTransactionReceipt = (args: { hash: Hex }) =>
    publicClient.waitForTransactionReceipt(args)

  const helperPrep = await ensurePhase3DryRunHelperOnFork({
    publicClient: publicClient as any,
    walletClient: walletClient as any,
    waitForTransactionReceipt,
    forkRequest,
    forkMode,
    batcher,
    rpcUrl,
    ownerBalanceHex,
  })
  const authPrep = await ensurePhase3HelperCreate2AuthorizationOnFork({
    publicClient: publicClient as any,
    walletClient: walletClient as any,
    waitForTransactionReceipt,
    forkRequest,
    forkMode,
    batcher,
    ownerBalanceHex,
  })

  const auxiliaryPrep = await ensureVaultAuxiliaryDeployBatcherOnFork({
    publicClient: publicClient as any,
    walletClient: walletClient as any,
    waitForTransactionReceipt,
    forkRequest,
    forkMode,
    batcher,
    rpcUrl,
    ownerBalanceHex,
  })

  return {
    ran: true,
    helperAlreadyAligned: helperPrep.alreadyAligned,
    helperEnsured: helperPrep.ensured,
    create2AlreadyAuthorized: authPrep.alreadyAuthorized,
    create2Ensured: authPrep.ensured,
    phase3Helper: authPrep.phase3Helper,
    create2Deployer: authPrep.create2Deployer,
    auxiliaryAlreadyAligned: auxiliaryPrep.alreadyAligned,
    auxiliaryEnsured: auxiliaryPrep.ensured,
    configuredAuxiliaryBatcher: auxiliaryPrep.configuredAuxiliaryBatcher,
    previousAuxiliaryBatcher: auxiliaryPrep.previousAuxiliaryBatcher,
    auxiliaryBatcher: auxiliaryPrep.auxiliaryBatcher,
    auxiliaryCreate2AlreadyAuthorized: auxiliaryPrep.create2AlreadyAuthorized,
    auxiliaryCreate2Ensured: auxiliaryPrep.create2Ensured,
  }
}
